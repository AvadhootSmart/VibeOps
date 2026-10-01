package tools

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"VibeOps/backend/ask"
	"VibeOps/backend/settings"
	"VibeOps/backend/shell"
	"VibeOps/backend/skills"
)

// A harness is a coding-agent CLI the user already has installed and logged in,
// driven as a subprocess: VibeOps writes one prompt, reads the CLI's own JSON
// event stream, and reaches its own tools back through `vibeops mcp`. The
// provider ids here are the ones config.json stores; bins maps each to the
// binary that actually runs.
var bins = map[string]string{
	"claude-code": "claude",
	"cursor":      "cursor-agent",
	"opencode":    "opencode",
}

// allowedTools names every manifest tool as Claude Code addresses it, for
// --allowedTools — without which it can't call them non-interactively in print
// mode (there's no permission prompt channel over -p). Derived from the
// manifest so a new tool is allowed the moment it exists, rather than working
// in one harness and silently not the other.
func allowedTools() string {
	names := Names()
	for i, n := range names {
		names[i] = "mcp__vibeops__" + n
	}
	return strings.Join(names, ",")
}

// selfMCP is how each CLI is pointed at this same binary in headless MCP mode
// (`vibeops mcp`), so it reaches VibeOps' tools over stdio. The three CLIs take
// it three different ways — inline flag, workspace file, env var — but the
// server definition underneath is the same, so it is built once here.
//
// The path is translated because on Windows the CLIs run inside WSL and have to
// exec us as /mnt/c/... . The child stays a Windows process on purpose: it must
// resolve the same os.UserConfigDir() as the GUI for the secret bridge to work.
//
// env (the run nonce, the ask listener, a plan approval) is written into the
// server's own definition rather than left to inheritance: Cursor spawns MCP
// servers with a scrubbed environment, so anything passed only to cursor-agent
// never reaches the child — secret requests were silently rejected, and every
// command would fail its approval for want of a window to ask in.
func selfMCP() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return shell.ToShellPath(exe), nil
}

// claudeMCPConfig is the inline --mcp-config JSON.
func claudeMCPConfig(env map[string]string) string {
	cmd, err := selfMCP()
	if err != nil {
		return "" // MCP tools are simply unavailable; the harness still runs
	}
	b, err := json.Marshal(map[string]any{"mcpServers": map[string]any{
		"vibeops": map[string]any{"command": cmd, "args": []string{"mcp"}, "env": env},
	}})
	if err != nil {
		return ""
	}
	return string(b)
}

// claudeHostTools are Claude Code's own shell and write tools, switched off so every
// command goes through shellAccess — sandboxed and approval-gated — instead of
// straight onto the host. Its read tools stay, for understanding a repo. The
// other CLIs get the same through their config (opencodeConfig, cursorWorkspace).
const claudeHostTools = "Bash,Edit,Write,NotebookEdit"

// opencodeConfig is the inline JSON opencode reads from OPENCODE_CONFIG_CONTENT.
// The explicit denies hold even under --auto, which only approves what is not
// denied (verified: bash cannot touch a file with them set).
func opencodeConfig(env map[string]string) string {
	cmd, err := selfMCP()
	if err != nil {
		return ""
	}
	b, err := json.Marshal(map[string]any{
		"permission": map[string]any{"bash": "deny", "edit": "deny"},
		"mcp": map[string]any{
			"vibeops": map[string]any{
				"type":        "local",
				"command":     []string{cmd, "mcp"},
				"enabled":     true,
				"environment": env,
			}},
	})
	if err != nil {
		return ""
	}
	return string(b)
}

// cursorWorkspace builds a throwaway directory holding a .cursor/mcp.json, and
// returns it for --workspace. Cursor has no inline MCP flag and reads only
// <workspace>/.cursor/mcp.json or ~/.cursor/mcp.json — and the second is the
// user's own file, which VibeOps has no business rewriting.
//
// One directory per run, not one shared one: the file carries this run's secret
// nonce, so two chats generating at once would otherwise overwrite each other's.
func cursorWorkspace(env map[string]string) (string, error) {
	cmd, err := selfMCP()
	if err != nil {
		return "", err
	}
	dir, err := os.MkdirTemp("", "vibeops-cursor-")
	if err != nil {
		return "", err
	}
	b, err := json.Marshal(map[string]any{"mcpServers": map[string]any{
		"vibeops": map[string]any{"command": cmd, "args": []string{"mcp"}, "env": env},
	}})
	if err != nil {
		os.RemoveAll(dir)
		return "", err
	}
	if err := os.MkdirAll(filepath.Join(dir, ".cursor"), 0o700); err != nil {
		os.RemoveAll(dir)
		return "", err
	}
	if err := os.WriteFile(filepath.Join(dir, ".cursor", "mcp.json"), b, 0o600); err != nil {
		os.RemoveAll(dir)
		return "", err
	}
	// Denies Cursor's own shell and writes. Unverified against --force (the CLI
	// could not be run where this was written), which is why Cursor still ships
	// behind the Experimental acknowledgement.
	deny := `{"permissions":{"allow":[],"deny":["Shell(*)","Write(**)"]}}`
	if err := os.WriteFile(filepath.Join(dir, ".cursor", "cli.json"), []byte(deny), 0o600); err != nil {
		os.RemoveAll(dir)
		return "", err
	}
	return dir, nil
}

// Policy is the sudo/secrets contract shared with the OpenRouter path, embedded
// from frontend/src/lib/ai/policy.md by main. Every path drives the same tools
// against the same machine, so stating the rules once per harness only produced
// more chances to be wrong.
var Policy string

// SetPolicy loads the embedded policy text. Called from main's init.
func SetPolicy(s string) { Policy = s }

// systemPrompt is the part specific to running as a VibeOps harness, plus the
// shared policy. Claude Code takes it as --append-system-prompt; Cursor and
// opencode have no such flag, so it is prepended to the first user message of a
// session instead (see prompt below).
func systemPrompt() string {
	prompt := `You are running inside VibeOps, an ops assistant for managing remote servers. ` +
		`Prefer the tools on the "vibeops" MCP server for server work: call getAllowedServers to see authorized servers, ` +
		`then sshConnect / sshRun / sshDisconnect to operate on them, and shellAccess for local commands. ` +
		`When a change is destructive (deletes data, causes downtime, hard to undo), state the plan and the exact commands before running them.` +
		"\n\n" + Policy
	// Without this the harness has useSkill but no idea which names exist.
	if catalog := skills.NewSkills().Catalog(); catalog != "" {
		prompt += "\n\n" + catalog
	}
	return prompt
}

// eventCtx is the Wails app context, needed to emit events to the frontend.
// Set once at startup (app.startup -> SetEventCtx). Package-level because there
// is a single app instance; ponytail: fine until we run multiple windows.
var eventCtx context.Context

// SetEventCtx wires the Wails runtime context used for streaming. Call from
// the app's OnStartup.
func SetEventCtx(ctx context.Context) { eventCtx = ctx }

// ponytail: Cursor and opencode need a blanket auto-approve flag (--force /
// --auto) to run non-interactively at all; their own shell and write tools are
// denied in config instead, and VibeOps' tools are gated in Go. Wiring ACP
// session/request_permission onto the approval UI is the upgrade path.
type Harness struct{}

func NewHarness() *Harness { return &Harness{} }

// probeTimeout bounds the "is this installed / what can it do" calls. Generous
// because the first one of these on Windows pays for the distro cold-starting,
// but finite because they run on app open and freeze the UI while they don't
// return.
const probeTimeout = 90 * time.Second

type AgentStatus struct {
	Installed bool   `json:"installed"`
	Version   string `json:"version"`
}

type Model struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Check detects one harness CLI and reads its version. Unknown ids report as
// not installed rather than erroring — the frontend asks about whatever rows it
// renders.
func (h *Harness) Check(agent string) AgentStatus {
	bin, ok := bins[agent]
	if !ok {
		return AgentStatus{}
	}
	// Deadline because on Windows this crosses into WSL: a distro that is
	// booting, wedged, or waiting on something in an rc file would otherwise
	// block this Wails call forever, and the settings screen with it.
	ctx, cancel := context.WithTimeout(context.Background(), probeTimeout)
	defer cancel()
	if !shell.Look(ctx, bin) {
		return AgentStatus{}
	}
	return AgentStatus{Installed: true, Version: version(ctx, bin)}
}

// version takes the first token of the last non-empty line of `<bin>
// --version`: claude answers "2.1.212 (Claude Code)", opencode prints a banner
// above the number, cursor-agent answers a bare date-stamped build.
func version(ctx context.Context, bin string) string {
	cmd, err := shell.Command(ctx, nil, bin, "--version")
	if err != nil {
		return ""
	}
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		if f := strings.Fields(lines[i]); len(f) > 0 {
			return f[0]
		}
	}
	return ""
}

// Models lists what the installed CLI will accept for --model. Asked of the CLI
// rather than hardcoded because Cursor's and opencode's catalogues are large and
// change weekly; a baked-in list would be wrong within the month.
func (h *Harness) Models(agent string) []Model {
	ctx, cancel := context.WithTimeout(context.Background(), probeTimeout)
	defer cancel()
	bin := bins[agent]
	var args []string
	switch agent {
	case "claude-code":
		return claudeModels(ctx)
	case "cursor", "opencode":
		args = []string{"models"}
	default:
		return []Model{}
	}
	cmd, err := shell.Command(ctx, nil, bin, args...)
	if err != nil {
		return []Model{}
	}
	out, err := cmd.Output()
	if err != nil {
		return []Model{}
	}
	models := []Model{}
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// cursor-agent prints "<id> - <display name>" under a heading; opencode
		// prints a bare "<provider>/<model>" per line.
		if id, name, ok := strings.Cut(line, " - "); ok {
			models = append(models, Model{ID: id, Name: name})
		} else if agent == "opencode" && strings.Contains(line, "/") {
			models = append(models, Model{ID: line, Name: line})
		}
	}
	return models
}

// claudeCatalogEntry matches an entry of the model catalog Claude Code bundles
// into its own binary (or cli.js for npm installs).
var claudeCatalogEntry = regexp.MustCompile(`id:"(claude-[a-z0-9-]+)",family:"([a-z]+)",display_name:"([^"]+)"`)

// claudeModels reads the model catalog out of the installed `claude` itself,
// since it has no list-models command — so the picker always matches what that
// exact CLI version knows. Through the shell, because on Windows the CLI lives
// inside WSL. ponytail: scrapes an internal format; if Anthropic reshapes it
// this returns nothing and the picker offers only the CLI's default.
func claudeModels(ctx context.Context) []Model {
	cmd, err := shell.Command(ctx, nil, "sh", "-c",
		`LC_ALL=C grep -aoE '`+claudeCatalogEntry.String()+`' "$(readlink -f "$(command -v claude)")"`)
	if err != nil {
		return []Model{}
	}
	out, _ := cmd.Output()
	return parseClaudeCatalog(string(out))
}

// claudeAliases are the families `--model` accepts by bare name, resolving to
// the newest model the CLI knows. Families outside it (e.g. mythos) are in the
// catalog but not offered to subscriptions, so they are left out.
var claudeAliases = []string{"fable", "opus", "sonnet", "haiku"}

func parseClaudeCatalog(out string) []Model {
	type entry struct{ id, family, name, version string }
	var entries []entry
	seen := map[string]bool{}
	for _, m := range claudeCatalogEntry.FindAllStringSubmatch(out, -1) {
		id, family, name := m[1], m[2], m[3]
		// claude-3-* are retired.
		if seen[id] || strings.HasPrefix(id, "claude-3-") || !slices.Contains(claudeAliases, family) {
			continue
		}
		seen[id] = true
		_, version, _ := strings.Cut(name, " ")
		entries = append(entries, entry{id, family, name, version})
	}
	slices.SortStableFunc(entries, func(a, b entry) int {
		return compareVersions(b.version, a.version)
	})

	models := []Model{}
	for _, alias := range claudeAliases {
		for _, e := range entries {
			if e.family == alias {
				models = append(models, Model{ID: alias, Name: fmt.Sprintf("Latest %s (%s)", strings.Fields(e.name)[0], e.version)})
				break
			}
		}
	}
	for _, e := range entries {
		models = append(models, Model{ID: e.id, Name: e.name})
	}
	return models
}

// compareVersions orders dotted versions numerically; a missing part reads as 0.
func compareVersions(a, b string) int {
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := range max(len(pa), len(pb)) {
		var x, y int
		if i < len(pa) {
			x, _ = strconv.Atoi(pa[i])
		}
		if i < len(pb) {
			y, _ = strconv.Atoi(pb[i])
		}
		if x != y {
			return x - y
		}
	}
	return 0
}

// Run executes one turn. agent picks the CLI; prompt is the new user message;
// resumeSessionID (if non-empty) continues a prior session of that CLI so
// history is kept without resending it. runID lets the frontend Cancel a run.
// Each JSON line the CLI emits is forwarded on event "harness:<runID>"; the
// final line is returned so the caller can read the authoritative answer +
// session id even if it missed an event.
func (h *Harness) Run(agent string, prompt string, resumeSessionID string, runID string) (string, error) {
	bin, ok := bins[agent]
	if !ok {
		return "", fmt.Errorf("unknown agent harness: %q", agent)
	}

	ctx, done := startRun(runID)
	defer done()
	// Clear any secrets this run collected — per-run lifetime, guaranteed even
	// on cancel/error because defer runs on every exit path.
	defer settings.ClearSecrets()

	// nonce authenticates secret-request files this run's mcp child writes; the
	// watcher only honors files carrying it. See docs/secret-request-flow.md.
	nonce := newNonce()
	go watchSecretRequest(ctx, nonce)

	model := ""
	if cfg, err := settings.NewSettings().Get(); err == nil {
		model = cfg.AgentModels[agent]
	}

	var args []string
	env := map[string]string{"VIBEOPS_RUN_NONCE": nonce}
	// askQuestion and the approval gate need the window, and the mcp grandchild
	// has none — so it is told where to reach this app.
	if addr := ask.Addr(); addr != "" {
		env[AskAddrEnv] = addr
		env[AskTokenEnv] = ask.Token()
	}
	if startTurn() {
		env[ApprovedEnv] = "1"
	}

	switch agent {
	case "claude-code":
		args = []string{
			"-p", prompt,
			"--output-format", "stream-json",
			"--verbose",
			"--include-partial-messages",
			"--append-system-prompt", systemPrompt(),
			"--allowedTools", allowedTools(),
			"--disallowedTools", claudeHostTools,
		}
		if cfg := claudeMCPConfig(env); cfg != "" {
			args = append(args, "--mcp-config", cfg)
		}
		if model != "" {
			args = append(args, "--model", model)
		}
		if resumeSessionID != "" {
			args = append(args, "--resume", resumeSessionID)
		}

	case "cursor":
		dir, err := cursorWorkspace(env)
		if err != nil {
			return "", err
		}
		defer os.RemoveAll(dir)
		args = []string{
			"-p", withSystemPrompt(prompt, resumeSessionID),
			"--output-format", "stream-json",
			"--stream-partial-output",
			"--workspace", shell.ToShellPath(dir),
			// --trust accepts the scratch workspace (there is no one to answer the
			// prompt); --force and --approve-mcps are what let tools run at all
			// without an interactive approval channel.
			"--trust", "--force", "--approve-mcps",
		}
		if model != "" {
			args = append(args, "--model", model)
		}
		if resumeSessionID != "" {
			args = append(args, "--resume", resumeSessionID)
		}

	case "opencode":
		args = []string{"run", "--format", "json", "--auto"}
		if model != "" {
			args = append(args, "--model", model)
		}
		if resumeSessionID != "" {
			args = append(args, "--session", resumeSessionID)
		}
		// The prompt is a positional, so it goes after `--`: without it a message
		// that happens to start with a dash is parsed as a flag.
		args = append(args, "--", withSystemPrompt(prompt, resumeSessionID))
		env["OPENCODE_CONFIG_CONTENT"] = opencodeConfig(env)
	}

	// shell.Command is what carries the env across the WSL boundary on Windows,
	// where plain inheritance would drop it.
	//
	// Not sandboxed, matching the existing behaviour on macOS: these CLIs need
	// their own config and credential dirs, and the tools they call come back
	// through ShellAccess, which is.
	cmd, err := shell.Command(ctx, env, bin, args...)
	if err != nil {
		return "", err
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}
	var stderr strings.Builder
	cmd.Stderr = &stderr

	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("failed to start `%s` (is it installed and on PATH?): %w", bin, err)
	}

	scanner := bufio.NewScanner(stdout)
	// Assistant messages / tool inputs can be large; give the scanner room.
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	var last string
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}
		if eventCtx != nil {
			runtime.EventsEmit(eventCtx, "harness:"+runID, line)
		}
		last = line
	}

	if err := cmd.Wait(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return last, fmt.Errorf("%s exited: %s", bin, msg)
	}
	return last, nil
}

// withSystemPrompt prepends the VibeOps instructions to the user's message for
// the CLIs that have no system-prompt flag. Only on a new session: a resumed
// one already has them in context, and repeating them every turn would spend
// the policy's worth of tokens per message and drown the actual question.
func withSystemPrompt(prompt, resumeSessionID string) string {
	if resumeSessionID != "" {
		return prompt
	}
	return systemPrompt() + "\n\n---\n\n" + prompt
}
