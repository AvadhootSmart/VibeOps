package tools

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"

	"VibeOps/backend/settings"
	"VibeOps/backend/shell"
)

// The SSH client runs on the Windows side of the WSL boundary — deliberately,
// since keys must never be loadable through the model's shell — so it reads
// %USERPROFILE%\.ssh while a WSL user's keys are in the Linux home. That hits
// exactly the users most likely to have working SSH already, so the failure
// names the other location instead of leaving them to guess. Empty elsewhere.
var knownHostsHint = map[string]string{
	"windows": `. VibeOps reads the Windows home (%USERPROFILE%\.ssh); if your keys live inside WSL, copy them across or pick one from \\wsl$\<distro>\home\<user>\.ssh`,
}[runtime.GOOS]

// SSH keeps live connections to remote servers so the agent can run many
// commands over one handshake. Sessions are keyed by "user@host:port".
// ponytail: key-file auth only — no passwords, no ssh-agent. Add agent auth
// (golang.org/x/crypto/ssh/agent) if users complain about passphrase keys.
type SSH struct {
	mu      sync.Mutex
	clients map[string]*ssh.Client
}

func NewSSH() *SSH { return &SSH{clients: map[string]*ssh.Client{}} }

// defaultKeyPaths in preference order when the caller doesn't name a key.
func defaultKeyPaths(home string) []string {
	return []string{
		filepath.Join(home, ".ssh", "id_ed25519"),
		filepath.Join(home, ".ssh", "id_rsa"),
	}
}

// Connect opens (or replaces) an SSH connection and returns its session ID.
// port <= 0 means 22. keyPath "" tries ~/.ssh/id_ed25519 then ~/.ssh/id_rsa.
// Host keys are verified against ~/.ssh/known_hosts; unknown hosts fail with
// instructions rather than hanging on an interactive prompt (the webview has
// no TTY, so anything interactive would freeze the agent).
func (s *SSH) Connect(host string, port int, user string, keyPath string) (string, error) {
	if port <= 0 {
		port = 22
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	candidates := []string{keyPath}
	if keyPath == "" {
		candidates = defaultKeyPaths(home)
	}
	var signer ssh.Signer
	var lastErr error
	for _, p := range candidates {
		keyBytes, err := os.ReadFile(p)
		if err != nil {
			lastErr = err
			continue
		}
		signer, err = ssh.ParsePrivateKey(keyBytes)
		if err != nil {
			if _, ok := err.(*ssh.PassphraseMissingError); ok {
				return "", fmt.Errorf("key %s is passphrase-protected; VibeOps can't prompt for passphrases — use an unencrypted key or add one via ssh-keygen", p)
			}
			lastErr = fmt.Errorf("parse %s: %w", p, err)
			continue
		}
		break
	}
	if signer == nil {
		return "", fmt.Errorf("no usable private key (tried %v): %v", candidates, lastErr)
	}

	hostKeys, err := knownhosts.New(filepath.Join(home, ".ssh", "known_hosts"))
	if err != nil {
		return "", fmt.Errorf("can't read ~/.ssh/known_hosts: %w — ssh into the server once from a terminal to record its host key%s", err, knownHostsHint)
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	client, err := ssh.Dial("tcp", addr, &ssh.ClientConfig{
		User:            user,
		Auth:            []ssh.AuthMethod{ssh.PublicKeys(signer)},
		HostKeyCallback: hostKeys,
		Timeout:         10 * time.Second,
	})
	if err != nil {
		return "", fmt.Errorf("connect %s@%s failed: %w (if 'knownhosts: key is unknown', ssh in once from a terminal first)", user, addr, err)
	}

	id := fmt.Sprintf("%s@%s", user, addr)
	s.mu.Lock()
	if old, ok := s.clients[id]; ok {
		old.Close()
	}
	s.clients[id] = client
	s.mu.Unlock()
	return id, nil
}

// RunRemote executes one command on an established connection and returns
// combined stdout+stderr. A non-zero exit status is reported inside the
// output (not as a Go error) so the model always sees what the command
// printed. Each call is a fresh remote shell: cd/env do not persist between
// calls. Commands are killed after 120s so a hung command can't freeze the
// agent, or sooner if the frontend Cancel(runID)s the run (user hit stop).
//
// Secrets are handled here rather than by the caller, so both agent paths get
// one implementation: $SECRET_ placeholders are substituted just before the
// command runs, held values are redacted back out of the output, and a sudo
// command picks the password up from the run-scoped store on its own. None of
// those values are ever returned to, or passed in by, the model's side. Nothing
// runs until the user approves it (see approval.go).
//
// The password reaches `sudo -S` on the remote over stdin — never the command
// string, so it can't leak into `ps`, shell history, or logs. There is no TTY
// over an exec session, which is why -S is needed at all. It is not handed to
// the model's command directly: see shell.SudoPreamble.
func (s *SSH) RunRemote(sessionID string, command string, runID string) (string, error) {
	sudoPassword := ""
	if localSudo.MatchString(command) {
		// Refusing here beats letting it through: with no TTY and no cached
		// credential, sudo fails with "a terminal is required", which reads to
		// the model like a broken server rather than a step it skipped.
		if sudoPassword = settings.GetSecret(settings.SudoSecret); sudoPassword == "" {
			return "", errors.New("this command uses sudo but the user has not authenticated yet: call sudoAuth once, then re-run this command unchanged")
		}
	}

	s.mu.Lock()
	client, ok := s.clients[sessionID]
	s.mu.Unlock()
	if !ok {
		return "", fmt.Errorf("no session %q — call Connect first (or the connection was dropped)", sessionID)
	}
	if err := approve("Run on "+sessionID+"?", command); err != nil {
		return "", err
	}
	// Kept apart from command: the errors below go back to the model, and the
	// injected text carries secret values.
	injected, err := settings.InjectSecrets(command)
	if err != nil {
		return "", err
	}

	sess, err := client.NewSession()
	if err != nil {
		// Connection likely died (server reboot, network drop) — forget it.
		s.mu.Lock()
		delete(s.clients, sessionID)
		s.mu.Unlock()
		client.Close()
		return "", fmt.Errorf("session %q is dead (%v) — reconnect with Connect", sessionID, err)
	}
	defer sess.Close()

	run := injected
	if sudoPassword != "" {
		sess.Stdin = strings.NewReader(sudoPassword + "\n")
		run = shell.SudoPreamble(injected)
	}

	type result struct {
		out []byte
		err error
	}
	ch := make(chan result, 1)
	go func() {
		out, err := sess.CombinedOutput(run)
		ch <- result{out, err}
	}()

	ctx, done := startRun(runID)
	defer done()

	select {
	case r := <-ch:
		out := string(r.out)
		if r.err != nil {
			out += fmt.Sprintf("\n[command failed: %v]", r.err)
		}
		return settings.Redact(out), nil
	case <-ctx.Done():
		sess.Close() // kills the remote command
		return "", fmt.Errorf("command cancelled: %s", command)
	case <-time.After(120 * time.Second):
		sess.Close()
		return "", fmt.Errorf("command timed out after 120s and was killed: %s", command)
	}
}

// Disconnect closes a connection and forgets its session ID.
func (s *SSH) Disconnect(sessionID string) (string, error) {
	s.mu.Lock()
	client, ok := s.clients[sessionID]
	delete(s.clients, sessionID)
	s.mu.Unlock()
	if !ok {
		return "", fmt.Errorf("no session %q", sessionID)
	}
	client.Close()
	return "disconnected " + sessionID, nil
}
