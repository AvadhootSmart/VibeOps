// Package tools holds the Go-side services exposed to the frontend as Wails
// bindings and consumed by the AI SDK as tools. Each service is a struct with
// methods; bind it in main.go and Wails generates a matching TS namespace under
// frontend/wailsjs/go/tools/. Add new capabilities as new methods here, or as
// new service structs for a new domain (e.g. SSH, Docker).
package tools

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"regexp"
	"runtime"
	"sync"
	"time"

	"VibeOps/backend/settings"
	"VibeOps/backend/shell"
)

// localSudo spots an attempt to elevate inside the sandboxed local shell.
//
// This is not the control that stops it — the kernel is. bubblewrap sets
// PR_SET_NO_NEW_PRIVS with no way to opt out, so sudo's setuid bit is inert,
// and the user namespace maps only our uid, so /etc/sudo.conf reads as owned by
// nobody. Obfuscating past this regex just swaps a clear message for those two.
//
// It exists because that pair of failures reads like a broken machine rather
// than a policy, and the model answers them by retrying instead of reaching for
// sshRun. Same reason the sensitiveDirs comment gives for NOT scanning scripts:
// the scan is never the boundary, but here it is the only place we can say why.
var localSudo = regexp.MustCompile(`\bsudo\b`)

const noLocalSudo = "sudo cannot run in the local shell: it is sandboxed, and the sandbox blocks privilege elevation (this is deliberate and cannot be turned on). Re-run the command without sudo if it only needs your own permissions. If it genuinely needs root, it needs a server — use sshConnect, then sudoAuth, then sshRun."

type Tool struct{}

func NewTools() *Tool { return &Tool{} }

// In-flight cancellable runs, keyed by a caller-supplied id. Shared across tool
// services (ShellAccess, RunRemote) so the single Cancel binding aborts any of
// them when the user hits stop in the UI.
var (
	runsMu sync.Mutex
	runs   = map[string]context.CancelFunc{}
)

// startRun registers id and returns a context that Cancel(id) will cancel.
// Call the returned done func when the run finishes so the entry doesn't leak.
// An empty id means "not cancellable" — the context still cancels on done.
func startRun(id string) (context.Context, func()) {
	ctx, cancel := context.WithCancel(context.Background())
	if id != "" {
		runsMu.Lock()
		runs[id] = cancel
		runsMu.Unlock()
	}
	return ctx, func() {
		cancel()
		if id != "" {
			runsMu.Lock()
			delete(runs, id)
			runsMu.Unlock()
		}
	}
}

// Cancel aborts an in-flight run (started by ShellAccess or RunRemote) whose id
// matches. No-op if it already finished. The frontend calls this when the user
// stops a generation so a hung command doesn't keep running.
func (t *Tool) Cancel(runID string) {
	runsMu.Lock()
	cancel := runs[runID]
	runsMu.Unlock()
	if cancel != nil {
		cancel()
	}
}

// CancelAll aborts every in-flight run. Wired to the app's OnShutdown so
// quitting mid-generation doesn't strand a harness CLI — on Windows the job
// object in backend/shell catches the crash case too, but a clean quit should
// not depend on the kernel reaping us.
func CancelAll() {
	runsMu.Lock()
	defer runsMu.Unlock()
	for _, cancel := range runs {
		cancel()
	}
}

type SystemInfo struct {
	OS        string `json:"os"`
	Arch      string `json:"arch"`
	CPUs      int    `json:"cpus"`
	Hostname  string `json:"hostname"`
	GoVersion string `json:"goVersion"`
	Time      string `json:"time"`
}

func (t *Tool) GetSystemInfo() (string, error) {
	host, err := os.Hostname()
	if err != nil {
		host = "unknown"
	}

	info := SystemInfo{
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		CPUs:      runtime.NumCPU(),
		Hostname:  host,
		GoVersion: runtime.Version(),
		Time:      time.Now().Format(time.RFC3339),
	}

	infoJson, err := json.Marshal(info)
	if err != nil {
		return "", err
	}
	return string(infoJson), nil
}

// GetCwd reports the working directory as the agent's shell sees it. Translated
// because the answer goes to the model and comes back as text in a shell
// command: on Windows the raw C:\Users\x would be nonsense to the bash inside
// WSL that ends up running it.
func (t *Tool) GetCwd() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	return shell.ToShellPath(wd), nil
}

// ShellAccess runs a full command line through a POSIX shell, so pipes,
// redirects, globbing, $VAR expansion and && all work — on Windows that shell
// lives inside WSL, which is why this signature says nothing about the OS.
// Returns combined stdout+stderr. runID lets the frontend Cancel a hung command.
//
// The shell is sandboxed away from credential stores (see backend/shell). Both
// agent paths — OpenRouter tools and the MCP child's shellAccess — route through
// here, so this is the single chokepoint for that guard, and for the
// $SECRET_ substitution and output redaction that go with it: doing either in
// the caller would mean two implementations of one boundary.
//
// Nothing runs until the user approves it (see approval.go).
//
// An unavailable sandbox is returned as an error rather than run unwrapped: the
// message reaches the model, so it reports the setup step instead of retrying.
//
// ponytail: still no timeout — cancel is user-driven; add a context deadline if
// unattended hangs bite.
func (t *Tool) ShellAccess(script string, runID string) (string, error) {
	if localSudo.MatchString(script) {
		return "", errors.New(noLocalSudo)
	}
	if err := approve("Run command?", script); err != nil {
		return "", err
	}
	injected, err := settings.InjectSecrets(script)
	if err != nil {
		return "", err
	}
	ctx, done := startRun(runID)
	defer done()
	cmd, err := shell.Cmd(ctx, injected)
	if err != nil {
		return "", err
	}
	output, err := cmd.CombinedOutput()
	return settings.Redact(string(output)), err
}

// ShellStatus reports whether local commands can run, for the setup card the
// frontend shows when WSL or bubblewrap is missing.
func (t *Tool) ShellStatus() shell.Status { return shell.Check() }
