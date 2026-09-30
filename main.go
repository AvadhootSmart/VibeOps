package main

import (
	"context"
	"embed"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"VibeOps/backend/ask"
	"VibeOps/backend/connectors"
	"VibeOps/backend/errlog"
	"VibeOps/backend/mcp"
	"VibeOps/backend/overview"
	"VibeOps/backend/sessions"
	"VibeOps/backend/settings"
	"VibeOps/backend/skills"
	"VibeOps/backend/tools"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

// adoptLoginPATH replaces this process's PATH with the one a login shell would
// have. A .app launched from Finder inherits launchd's minimal
// PATH (/usr/bin:/bin:/usr/sbin:/sbin), so `claude`, `bunx`, `wrangler` and
// `vercel` — which live in ~/.bun/bin, ~/.volta/bin or /opt/homebrew/bin — are
// simply not found. Launching from a terminal (`wails dev`) hides the problem
// entirely, which is why it has to be fixed here rather than noticed later.
//
// Setting it on the process itself, once, fixes every call site at the same
// time: exec.LookPath resolves against the process PATH (not a child's Env), and
// every child — `claude`, the `vibeops mcp` grandchild, every `sh -c` — inherits
// it. Failure is non-fatal: keep whatever we already had.
//
// This is macOS/Linux only, and the SHELL check is what makes it so. Windows has
// the same problem one boundary further in — a non-login bash inside WSL never
// sources .bashrc — but it must NOT be fixed here: writing a Linux PATH onto the
// Windows process would break every lookup the app does on its own side. See the
// probe in backend/shell/shell_windows.go, which scopes it to the WSL scripts.
//
// The shell runs INTERACTIVE (-i) as well as login (-l): version managers put
// their PATH edits in .zshrc / .bashrc, which a login-only shell never reads.
// Without -i, `bunx` and anything volta- or nvm-managed stays invisible.
// Interactive means the rc file may also print things, so the value is fenced
// in markers and everything around it discarded.
func adoptLoginPATH() {
	shell := os.Getenv("SHELL")
	if shell == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, shell, "-ilc",
		`printf "__VIBEOPS_PATH__%s__END__" "$PATH"`).Output()
	if err != nil {
		return
	}
	_, rest, ok := strings.Cut(string(out), "__VIBEOPS_PATH__")
	if !ok {
		return
	}
	p, _, ok := strings.Cut(rest, "__END__")
	if ok && len(p) > len(os.Getenv("PATH")) {
		os.Setenv("PATH", p)
	}
}

// escapeSystemCwd moves the process out of a Windows system directory. A GUI
// app launched through UAC or a shell handler inherits C:\Windows\System32 as
// its working directory, and that is then what the agent's sandboxed shell, the
// Claude Code child and every relative path resolve against — writes there are
// blocked by ACLs only while VibeOps runs unelevated, which is not a guarantee
// worth leaning on. Home is what a terminal would have given us anyway.
//
// Conditional rather than unconditional because cwd is load-bearing elsewhere:
// backend/skills resolves .agents/skills against it, and `wails dev` runs from
// the repo root where that directory exists.
func escapeSystemCwd() {
	wd, err := os.Getwd()
	if err != nil || !underSystemRoot(wd) {
		return
	}
	if home, err := os.UserHomeDir(); err == nil {
		os.Chdir(home)
	}
}

// underSystemRoot is false everywhere but Windows, where %SystemRoot% is the
// only variable that reliably names C:\Windows. Compared case-insensitively
// because Windows paths are, and bounded at a separator so C:\WindowsApps does
// not read as being inside C:\Windows.
//
// The separators are listed rather than left to os.IsPathSeparator, which drops
// the backslash off Windows — the one place this runs would then be the one
// place the test could not reach.
func underSystemRoot(wd string) bool {
	root := os.Getenv("SystemRoot")
	if root == "" || len(wd) < len(root) || !strings.EqualFold(wd[:len(root)], root) {
		return false
	}
	return len(wd) == len(root) || wd[len(root)] == '\\' || wd[len(root)] == '/'
}

func main() {
	// Do this before anything looks up a binary — see adoptLoginPATH.
	adoptLoginPATH()

	// Before the MCP branch: that child runs ShellAccess too, and inherits this.
	escapeSystemCwd()

	errlog.Build = productVersion()

	// Headless MCP mode: each harness CLI spawns this same binary as
	// `vibeops mcp` to expose VibeOps tools over stdio. Short-circuit before any
	// GUI init.
	if len(os.Args) > 1 && os.Args[1] == "mcp" {
		if err := mcp.Serve(); err != nil {
			errlog.Write("mcp", err.Error())
			os.Exit(1)
		}
		return
	}

	// Before the services: the harness reads the address when it launches a CLI.
	// A failure here costs askQuestion and nothing else.
	if err := ask.Serve(); err != nil {
		errlog.Write("ask", "listener unavailable: "+err.Error())
	}

	app := NewApp()

	// Tool services — each is bound separately and gets its own TS namespace
	// under frontend/wailsjs/go/tools/. Add new services to the Bind list below.
	askSvc := ask.NewAsk()
	toolsSvc := tools.NewTools()
	sshSvc := tools.NewSSH()
	harnessSvc := tools.NewHarness()

	// Settings — app config (secrets, prefs) backed by the OS keychain.
	settings := settings.NewSettings()

	// Connectors — the deploy-target CLIs VibeOps installs and authenticates.
	connectorsSvc := connectors.NewConnectors()

	// Sessions — persisted chat history, stored as JSON on disk.
	sessionsSvc := sessions.NewSessions()

	// Skills — SKILL.md files from .agents/skills, injected into the agent
	// prompt and fetched on demand (progressive disclosure).
	skillsSvc := skills.NewSkills()

	// Overview — the server snapshot the agent generates, persisted as JSON.
	overviewSvc := overview.NewOverview()

	err := wails.Run(&options.App{
		Title:  "VibeOps",
		Width:  1024,
		Height: 768,
		// Width:  1920,
		// Height: 1080,
		// The sidebar is 256px expanded; below ~900px content starts to break.
		MinWidth:  900,
		MinHeight: 600,
		// macOS: hide the native title bar so the app's chrome fills the whole
		// window. Traffic lights stay and overlay the app's top-left (sidebar
		// header); the frontend clears them with padding and marks a drag region.
		Mac: &mac.Options{
			TitleBar: mac.TitleBarHiddenInset(),
		},
		// Windows has no hidden-title-bar mode, so the frame goes and the app
		// draws its own minimise/maximise/close (WindowControls).
		Frameless: runtime.GOOS == "windows",
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
			askSvc,
			toolsSvc,
			sshSvc,
			harnessSvc,
			settings,
			connectorsSvc,
			sessionsSvc,
			skillsSvc,
			overviewSvc,
		},
	})

	if err != nil {
		errlog.Write("app", err.Error())
	}
}
