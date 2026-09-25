package shell

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	installWSL   = "WSL is required to run local commands. Open an admin PowerShell, run `wsl --install`, reboot, and restart VibeOps."
	installBwrap = "bubblewrap is required to sandbox local commands. Run `sudo apt install bubblewrap` inside your WSL distro and restart VibeOps."

	// CREATE_NO_WINDOW. Spelled out rather than pulled from x/sys/windows,
	// which is only an indirect dependency here.
	createNoWindow = 0x08000000
)

// job ties every descendant process to the lifetime of VibeOps itself. Windows
// puts a new process in its parent's job automatically, so assigning ourselves
// once covers wsl.exe, taskkill and git without touching a single call site —
// and KILL_ON_JOB_CLOSE means the kernel reaps the tree even when we crash or
// are killed, where a deferred cancel never runs. Without it a wedged wsl.exe
// outlives the app and holds the distro open, and the next launch inherits the
// mess.
//
// The handle is deliberately never closed: closing it is what triggers the
// kill, so it must stay open until the process ends.
var job windows.Handle

func init() {
	h, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return
	}
	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{
		BasicLimitInformation: windows.JOBOBJECT_BASIC_LIMIT_INFORMATION{
			LimitFlags: windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
		},
	}
	_, err = windows.SetInformationJobObject(h, windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)), uint32(unsafe.Sizeof(info)))
	if err == nil {
		err = windows.AssignProcessToJobObject(h, windows.CurrentProcess())
	}
	if err != nil {
		windows.CloseHandle(h)
		return
	}
	job = h
}

// Hide keeps a child from allocating a console. VibeOps is linked -H windowsgui
// so it has no console of its own, and every console child — wsl.exe, taskkill —
// otherwise gets a fresh one that flashes on screen. The settings pane spawns
// two per connector, so the flashes arrive in a burst.
func Hide(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: createNoWindow}
	return cmd
}

// wslEnv is what a login shell inside the distro would have told us. The Windows
// process can't know any of it: $HOME is the Linux home, and $PATH is whatever
// nvm/bun/volta wrote into .bashrc, which the non-login `bash -s` we exec later
// never sources. Same problem adoptLoginPATH solves for a Finder-launched .app
// on macOS, one boundary further in.
type wslEnv struct {
	path     string
	home     string
	hasBwrap bool
	// mntOK reports whether drive automount is on. With it off there is no
	// /mnt/c, so the Windows home isn't reachable from the distro — and mounting
	// a tmpfs over a path that doesn't exist would fail the whole invocation.
	mntOK bool
	// present holds the sensitive paths that exist under the Linux home, which
	// only the distro can see. ponytail: cached with the rest of the probe, so a
	// credential file created mid-session goes unhidden until restart.
	present map[string]bool
	err     error
}

var (
	probeMu sync.Mutex
	probed  wslEnv
)

// probe caches only a *successful* answer. A cold distro can take longer to
// answer than the timeout below, and caching that failure once left the app
// insisting WSL wasn't installed for the rest of the session — the user's only
// fix being a restart. The mutex also keeps a burst of callers (CheckAll,
// three harness rows) from starting a distro each.
func probe() wslEnv {
	probeMu.Lock()
	defer probeMu.Unlock()
	if probed.err == nil && probed.path != "" {
		return probed
	}
	probed = runProbe()
	return probed
}

func runProbe() wslEnv {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// -il is login AND interactive for the reason spelled out in adoptLoginPATH:
	// version managers put their PATH edits in .bashrc, which a login-only shell
	// never reads. Interactive means the rc files may print things, so the values
	// are fenced in markers and everything around them is discarded.
	//
	// This is the one place we pass a script to wsl.exe as an argument rather
	// than on stdin, and it is safe because the string is a constant — no user or
	// model input goes near it.
	cmd := Hide(exec.CommandContext(ctx, "wsl.exe", "-e", "bash", "-ilc",
		`printf "__VIBEOPS__%s\n%s\n%s\n%s\n%s__END__" "$PATH" "$HOME" "$(command -v bwrap)" "$(test -d /mnt && echo yes)" "$(echo $(cd && ls -d `+
			strings.Join(append(append([]string{}, sensitiveDirs...), sensitiveFiles...), " ")+` 2>/dev/null))"`))
	var stderr strings.Builder
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		// Covers both "wsl.exe missing" and the commoner "wsl.exe present, no
		// distro installed" — the second reports a confusing error of its own, so
		// it gets replaced with instructions.
		return wslEnv{err: errors.New(installWSL)}
	}

	_, rest, ok := strings.Cut(string(out), "__VIBEOPS__")
	if !ok {
		return wslEnv{err: errors.New(installWSL)}
	}
	body, _, ok := strings.Cut(rest, "__END__")
	if !ok {
		return wslEnv{err: errors.New(installWSL)}
	}
	f := strings.Split(body, "\n")
	if len(f) < 5 || f[0] == "" || f[1] == "" {
		return wslEnv{err: errors.New(installWSL)}
	}
	present := map[string]bool{}
	for _, rel := range strings.Fields(f[4]) {
		present[rel] = true
	}
	return wslEnv{path: f[0], home: f[1], hasBwrap: f[2] != "", mntOK: f[3] == "yes", present: present}
}

// killTree makes cancellation reach past our direct child. That child is the
// wsl.exe relay, and TerminateProcess — all exec.CommandContext does on its own
// — leaves everything the relay started behind, including the `VibeOps.exe mcp`
// grandchild Claude Code spawns. taskkill /T walks the tree instead.
//
// The shell inside the distro is covered separately, by bwrap's
// --die-with-parent. ponytail: `claude` is not under bwrap, so a cancelled run
// can leave one alive inside WSL; wrap it in --die-with-parent too if that shows
// up in practice.
func killTree(cmd *exec.Cmd) *exec.Cmd {
	Hide(cmd)
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return nil
		}
		Hide(exec.Command("taskkill", "/T", "/F", "/PID", strconv.Itoa(cmd.Process.Pid))).Run()
		return nil
	}
	return cmd
}

func Check() Status {
	e := probe()
	switch {
	case e.err != nil:
		return Status{Message: e.err.Error()}
	case !e.hasBwrap:
		return Status{Message: installBwrap}
	}
	return Status{Ready: true}
}

func Cmd(ctx context.Context, script string) (*exec.Cmd, error) {
	e := probe()
	if s := Check(); !s.Ready {
		return nil, errors.New(s.Message)
	}

	homes := []string{e.home}
	win, err := os.UserHomeDir()
	winShell := ToShellPath(win)
	if err == nil && e.mntOK {
		homes = append(homes, winShell)
	}
	exists := func(p string) bool {
		if rel, ok := strings.CutPrefix(p, winShell+"/"); ok && err == nil {
			_, statErr := os.Stat(filepath.Join(win, filepath.FromSlash(rel)))
			return statErr == nil
		}
		return e.present[strings.TrimPrefix(p, e.home+"/")]
	}

	args := append([]string{"-e", "bwrap"}, bwrapArgs(homes, exists)...)
	args = append(args, "bash", "-s")
	cmd := exec.CommandContext(ctx, "wsl.exe", args...)
	// The script goes in on stdin, never as an argument: wsl.exe re-quotes the
	// command line it is given on top of Go's own Windows escaping, and any
	// script containing a quote or a newline comes out the other side mangled.
	cmd.Stdin = strings.NewReader("export PATH=" + Quote(e.path) + "\n" + script)
	return killTree(cmd), nil
}

func Command(ctx context.Context, env map[string]string, name string, args ...string) (*exec.Cmd, error) {
	e := probe()
	if e.err != nil {
		return nil, e.err
	}

	var b strings.Builder
	fmt.Fprintf(&b, "export PATH=%s\n", Quote(e.path))

	names := make([]string, 0, len(env))
	for k := range env {
		names = append(names, k)
	}
	sort.Strings(names)
	for _, k := range names {
		fmt.Fprintf(&b, "export %s=%s\n", k, Quote(env[k]))
	}
	if len(names) > 0 {
		// A Windows .exe launched from inside WSL inherits none of the Linux
		// environment unless WSLENV names what to carry across. Claude Code
		// spawns `VibeOps.exe mcp` exactly that way, so without this the run
		// nonce never arrives and every secret request is silently rejected.
		fmt.Fprintf(&b, "export WSLENV=%s\n", Quote(strings.Join(names, ":")))
	}

	b.WriteString("exec " + Quote(name))
	for _, a := range args {
		b.WriteString(" " + Quote(a))
	}

	cmd := exec.CommandContext(ctx, "wsl.exe", "-e", "bash", "-s")
	cmd.Stdin = strings.NewReader(b.String())
	return killTree(cmd), nil
}

// ToShellPath turns a Windows path into the one the shell inside WSL sees:
// C:\Users\x -> /mnt/c/Users/x. Paths that are already POSIX pass through with
// only their separators normalised.
func ToShellPath(p string) string { return winToShellPath(p) }

// Look reports whether a program is runnable. It has to ask the distro rather
// than call exec.LookPath: `claude`, `npm` and the connector CLIs live inside
// WSL, and the Windows PATH knows nothing about them.
// `command` is a shell builtin, so this runs it as a script rather than going
// through Command, whose exec would refuse to replace the shell with a builtin.
func Look(ctx context.Context, name string) bool {
	e := probe()
	if e.err != nil {
		return false
	}
	cmd := Hide(exec.CommandContext(ctx, "wsl.exe", "-e", "bash", "-s"))
	cmd.Stdin = strings.NewReader("export PATH=" + Quote(e.path) + "\ncommand -v " + Quote(name))
	return cmd.Run() == nil
}
