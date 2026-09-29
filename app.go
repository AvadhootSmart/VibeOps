package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"VibeOps/backend/ask"
	"VibeOps/backend/connectors"
	"VibeOps/backend/errlog"
	"VibeOps/backend/overview"
	"VibeOps/backend/settings"
	"VibeOps/backend/shell"
	"VibeOps/backend/tools"
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Give the tools package the runtime context so streaming services
	// (Harness) can emit events to the frontend.
	tools.SetEventCtx(ctx)
	ask.SetEventCtx(ctx)
	overview.SetEventCtx(ctx)
	connectors.SetEventCtx(ctx)
	settings.ClearSecrets()
	removeReplacedExe()
	// Notifications only exist to bring the user back, so a click restores the
	// window even if it was minimised.
	runtime.OnNotificationResponse(ctx, func(runtime.NotificationResult) {
		runtime.WindowUnminimise(ctx)
		runtime.WindowShow(ctx)
	})
}

func (a *App) shutdown(ctx context.Context) {
	tools.CancelAll()
	settings.ClearSecrets()
}

// wails.json is the single source of the version: `wails build` stamps the
// bundle from info.productVersion, and Version() reads the same field.
//
//go:embed wails.json
var wailsConfig []byte

func productVersion() string {
	var cfg struct {
		Info struct {
			ProductVersion string `json:"productVersion"`
		} `json:"info"`
	}
	json.Unmarshal(wailsConfig, &cfg)
	return cfg.Info.ProductVersion
}

// LogError records an error the webview hit — a failed provider, connector or
// agent turn — in error.log.
func (a *App) LogError(source, message string) { errlog.Write(source, message) }

func (a *App) ShowErrorLog() error { return errlog.Reveal() }

type VersionInfo struct {
	Current string `json:"current"`
	Latest  string `json:"latest"`
}

// Version reports the running build's version plus the one advertised at
// getvibeops.in. The fetch lives in Go because the manifest sends no CORS
// headers, so the same request from the webview would be blocked. A failed
// check leaves Latest empty — no update banner, no error to the user.
func (a *App) Version() VersionInfo {
	v := VersionInfo{Current: productVersion()}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("https://getvibeops.in/manifest")
	if err != nil {
		return v
	}
	defer resp.Body.Close()

	var manifest struct {
		Version string `json:"version"`
	}
	if json.NewDecoder(resp.Body).Decode(&manifest) == nil {
		v.Latest = manifest.Version
	}
	return v
}

// ChangeCwd moves the whole process — every shell command and the Claude Code
// child inherit it — so a deployment can point the agent at a project once
// instead of prefixing every command with a cd.
// ponytail: process-global, so one project at a time. Per-run working dirs if
// concurrent deployments ever matter.
func (a *App) ChangeCwd(path string) error {
	return os.Chdir(path)
}

// repoFolder is the checkout directory name for a repo URL. It must stay inside
// the workspaces folder, so anything that isn't a plain name is refused rather
// than cleaned up — a URL is user input pointing at a filesystem path.
func repoFolder(url string) (string, error) {
	name := strings.TrimSuffix(path.Base(strings.TrimSuffix(url, "/")), ".git")
	if name == "" || name == "." || name == ".." || name == "/" ||
		strings.ContainsAny(name, `/\`) {
		return "", fmt.Errorf("cannot derive a folder name from %q", url)
	}
	return name, nil
}

// CloneRepo clones url into the workspaces folder and returns the checkout
// path, so a GitHub deployment becomes the local-folder flow. An existing
// checkout is fetched instead of failing on a non-empty directory.
func (a *App) CloneRepo(url string) (string, error) {
	dir, err := a.WorkspacesDir()
	if err != nil {
		return "", err
	}
	name, err := repoFolder(url)
	if err != nil {
		return "", err
	}
	dest := filepath.Join(dir, name)

	args := []string{"clone", url, dest}
	if _, err := os.Stat(dest); err == nil {
		args = []string{"-C", dest, "pull", "--ff-only"}
	}
	if out, err := shell.Hide(exec.Command("git", args...)).CombinedOutput(); err != nil {
		return "", fmt.Errorf("git %s: %s", args[0], strings.TrimSpace(string(out)))
	}
	return dest, nil
}

// WorkspacesDir is where VibeOps clones repos it deploys. Returned absolute and
// already created: the path is pasted into a prompt and ends up inside shell
// commands, and "~" only expands unquoted — an agent that writes
// `cd "~/VibeOps/workspaces"` would silently make a directory called `~`.
func (a *App) WorkspacesDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, "VibeOps", "workspaces")
	return dir, os.MkdirAll(dir, 0o755)
}

// ShellPath translates a local path into the form the agent's shell sees. It
// only differs on Windows, where commands run inside WSL and C:\ shows up as
// /mnt/c. Everything else — pickers, os.Chdir, clone destinations — keeps using
// the native path, so this is called at the one boundary where a path stops
// being a filesystem argument and becomes text in a prompt.
func (a *App) ShellPath(p string) string { return shell.ToShellPath(p) }

// ChooseDirectory opens the native folder picker so the user can point a
// deployment at a local project. Returns "" if the user cancels.
func (a *App) ChooseDirectory() (string, error) {
	home, _ := os.UserHomeDir()
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "Choose project folder",
		DefaultDirectory: home,
	})
}

// ChooseKeyFile opens the native file picker at ~/.ssh so the user can select
// any private key (including ones nested in subfolders). Returns "" if the
// user cancels.
func (a *App) ChooseKeyFile() (string, error) {
	home, _ := os.UserHomeDir()
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "Choose SSH key",
		DefaultDirectory: filepath.Join(home, ".ssh"),
	})
}
