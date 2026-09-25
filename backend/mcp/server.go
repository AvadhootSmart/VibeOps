// Package mcp is a local stdio MCP server exposing VibeOps' own tools (allowed
// servers, SSH) to the agent-harness CLIs — Claude Code, Cursor, opencode. It
// reuses backend/tools and backend/settings directly, so it shares the same
// config.json (allowed servers), SSH keys, and known_hosts as the desktop app —
// no separate config, no IPC. Each harness spawns the VibeOps binary in this
// mode (`vibeops mcp`) and calls these tools instead of its own file/exec ones.
//
// Transport: newline-delimited JSON-RPC 2.0 over stdin/stdout (the MCP stdio
// convention). Hand-rolled rather than pulling an SDK — the tools surface is
// tiny and the protocol is stable.
//
// shellAccess and sshRun stop for the user's approval inside backend/tools,
// asking the running app over the loopback ask listener, so this path is gated
// the same as the OpenRouter one. Secrets are bridged too: sudoAuth and
// secretRequest ask the running app to prompt the user, then sshRun/shellAccess
// substitute the collected values at execution time and redact them out of the
// output. The model never sees a value. See docs/secret-request-flow.md.
package mcp

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"VibeOps/backend/overview"
	"VibeOps/backend/settings"
	"VibeOps/backend/skills"
	"VibeOps/backend/tools"
)

const protocolVersion = "2025-06-18"

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"` // absent on notifications
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type server struct {
	ssh    *tools.SSH
	set    *settings.Settings
	tool   *tools.Tool
	ov     *overview.Overview
	skills *skills.Skills
	out    *json.Encoder
}

// Serve runs the MCP loop until stdin closes. Blocks.
func Serve() error {
	s := &server{
		ssh:    tools.NewSSH(),
		set:    settings.NewSettings(),
		tool:   tools.NewTools(),
		ov:     overview.NewOverview(),
		skills: skills.NewSkills(),
		out:    json.NewEncoder(os.Stdout),
	}
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var req rpcRequest
		if err := json.Unmarshal(line, &req); err != nil {
			continue // malformed frame; skip
		}
		s.handle(&req)
	}
	return scanner.Err()
}

func (s *server) reply(id json.RawMessage, result any) {
	s.out.Encode(rpcResponse{JSONRPC: "2.0", ID: id, Result: result})
}

func (s *server) fail(id json.RawMessage, code int, msg string) {
	s.out.Encode(rpcResponse{JSONRPC: "2.0", ID: id, Error: &rpcError{Code: code, Message: msg}})
}

func (s *server) handle(req *rpcRequest) {
	switch req.Method {
	case "initialize":
		s.reply(req.ID, map[string]any{
			"protocolVersion": protocolVersion,
			"capabilities":    map[string]any{"tools": map[string]any{}},
			"serverInfo":      map[string]any{"name": "vibeops", "version": "0.1.0"},
		})
	case "notifications/initialized", "notifications/cancelled":
		// notifications carry no id and expect no response
	case "ping":
		s.reply(req.ID, map[string]any{})
	case "tools/list":
		// Served verbatim from the shared manifest, so what Claude Code sees is
		// byte-for-byte what the AI-SDK path sees.
		s.reply(req.ID, map[string]any{"tools": tools.Manifest})
	case "tools/call":
		s.callTool(req)
	default:
		if len(req.ID) > 0 {
			s.fail(req.ID, -32601, "method not found: "+req.Method)
		}
	}
}

// text wraps a tool's output as MCP text content. isError marks a failed call
// so the model sees it as an error result rather than a normal one.
func textResult(text string, isError bool) map[string]any {
	return map[string]any{
		"content": []map[string]any{{"type": "text", "text": text}},
		"isError": isError,
	}
}

func (s *server) callTool(req *rpcRequest) {
	var p struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(req.Params, &p); err != nil {
		s.fail(req.ID, -32602, "invalid params")
		return
	}
	arg := func(key string) string {
		var m map[string]any
		json.Unmarshal(p.Arguments, &m)
		if v, ok := m[key].(string); ok {
			return v
		}
		return ""
	}

	switch p.Name {
	case "getAllowedServers":
		servers, err := s.set.GetAllowedServers()
		if err != nil {
			s.reply(req.ID, textResult(err.Error(), true))
			return
		}
		b, _ := json.Marshal(servers)
		s.reply(req.ID, textResult(string(b), false))

	case "sshConnect":
		var a struct {
			Host    string `json:"host"`
			Port    int    `json:"port"`
			User    string `json:"user"`
			KeyPath string `json:"keyPath"`
		}
		json.Unmarshal(p.Arguments, &a)
		id, err := s.ssh.Connect(a.Host, a.Port, a.User, a.KeyPath)
		s.reply(req.ID, textResult(orErr(id, err), err != nil))

	case "sshRun":
		// runID empty: no cancellation channel here. Secret substitution, output
		// redaction and the sudo password all happen inside RunRemote.
		out, err := s.ssh.RunRemote(arg("sessionId"), arg("command"), "")
		s.reply(req.ID, textResult(orErr(out, err), err != nil))

	case "sudoAuth":
		msg, err := requestSecret(settings.SudoSecret, "run: "+arg("command"))
		s.reply(req.ID, textResult(msg, err != nil))

	case "secretRequest":
		msg, err := requestSecret(arg("name"), arg("reason"))
		s.reply(req.ID, textResult(msg, err != nil))

	case "sshDisconnect":
		out, err := s.ssh.Disconnect(arg("sessionId"))
		s.reply(req.ID, textResult(orErr(out, err), err != nil))

	case "shellAccess":
		out, err := s.tool.ShellAccess(arg("script"), "")
		s.reply(req.ID, textResult(orErr(out, err), err != nil))

	case "getSystemInfo":
		out, err := s.tool.GetSystemInfo()
		s.reply(req.ID, textResult(orErr(out, err), err != nil))

	case "askQuestion":
		out, err := s.tool.AskQuestion(arg("question"), arg("header"), arg("options"))
		s.reply(req.ID, textResult(orErr(out, err), err != nil))

	case "getCwd":
		out, err := s.tool.GetCwd()
		s.reply(req.ID, textResult(orErr(out, err), err != nil))

	case "useSkill":
		body := s.skills.Read(arg("name"))
		if body == "" {
			body = fmt.Sprintf("No skill named %q.", arg("name"))
		}
		s.reply(req.ID, textResult(body, false))

	case "generateOverview":
		// Arguments are already the Data shape; hand the raw JSON straight to
		// the binding, which unmarshals and persists it (no Wails event here).
		err := s.ov.GenerateOverview(string(p.Arguments))
		s.reply(req.ID, textResult(orErr("Overview updated.", err), err != nil))

	case "proposeProviders", "proposePlan":
		// Render-only: the desktop app draws the card from the arguments it
		// already saw stream past on the harness event channel, so there is
		// nothing to do here but acknowledge and hold the CLI back.
		s.reply(req.ID, textResult("Shown to the user as a card. Do not repeat its contents in your reply. Stop here and wait for their answer; run nothing until they give it.", false))

	default:
		s.fail(req.ID, -32602, "unknown tool: "+p.Name)
	}
}

// requestSecret writes a secret-request file the running VibeOps app watches,
// then blocks until the user answers — the app stores the value in the keychain
// and deletes the file — or until it times out. The value itself never comes
// back here; the caller only learns whether it is now available.
// See docs/secret-request-flow.md.
func requestSecret(name, reason string) (string, error) {
	if !settings.ValidSecretName(name) {
		return "Invalid secret name: use letters, digits and underscores only (e.g. DATABASE_URL).", fmt.Errorf("bad name")
	}
	nonce := os.Getenv("VIBEOPS_RUN_NONCE")
	if nonce == "" {
		return "Secrets are unavailable here (no running VibeOps app to prompt the user).", fmt.Errorf("no nonce")
	}
	path := settings.SecretRequestPath()
	body, _ := json.Marshal(secretRequestFile{Nonce: nonce, Name: name, Reason: reason})
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err.Error(), err
	}
	if err := os.WriteFile(path, body, 0o600); err != nil {
		return err.Error(), err
	}
	deadline := time.Now().Add(120 * time.Second)
	for time.Now().Before(deadline) {
		time.Sleep(250 * time.Millisecond)
		if settings.GetSecret(name) != "" {
			if name == settings.SudoSecret {
				return "Authenticated. The user's sudo password is set for this run; proceed with the sudo command via sshRun.", nil
			}
			return fmt.Sprintf("The user provided %s. Its value is deliberately withheld from you — write $SECRET_%s (unquoted) wherever it is needed and VibeOps substitutes it at execution time.", name, name), nil
		}
		if _, err := os.Stat(path); os.IsNotExist(err) {
			// File deleted with no value set = user declined.
			return fmt.Sprintf("The user declined to provide %s; do not attempt to obtain or guess it.", name), fmt.Errorf("declined")
		}
	}
	os.Remove(path)
	return fmt.Sprintf("Timed out waiting for the user to provide %s.", name), fmt.Errorf("timeout")
}

// secretRequestFile mirrors the struct the app-side watcher reads
// (tools.secretRequest); both processes are the same binary.
type secretRequestFile struct {
	Nonce  string `json:"nonce"`
	Name   string `json:"name"`
	Reason string `json:"reason"`
}

func orErr(out string, err error) string {
	if err != nil {
		if out != "" {
			return fmt.Sprintf("%s\n[error: %v]", out, err)
		}
		return err.Error()
	}
	return out
}
