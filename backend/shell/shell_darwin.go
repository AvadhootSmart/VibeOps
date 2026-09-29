package shell

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// macOnlyDirs extend sensitiveDirs with where macOS keeps the Keychain and
// browser profiles (cookies and saved passwords).
var macOnlyDirs = []string{
	"Library/Keychains",
	"Library/Cookies",
	"Library/Application Support/Google/Chrome",
	"Library/Application Support/Firefox",
	"Library/Application Support/BraveSoftware",
	"Library/Application Support/Arc",
}

// seatbelt builds the sandbox-exec profile and its -D parameters. macOS has no
// bubblewrap, but sandbox-exec gives the same guarantee: the kernel enforces
// it, so every bypass the model might reach for fails exactly like cat does.
// Paths go in as parameters rather than spliced into the profile, so a home
// directory with a quote in it can't rewrite the rules.
//
// The mach-lookup denials have no counterpart on the other platforms — Linux has
// no Keychain, and Windows Credential Manager is already unreachable from inside
// WSL, which is one thing the VM boundary does buy us.
func seatbelt(home string) (profile string, params []string) {
	var rules []string
	add := func(kind, rel string) {
		name := fmt.Sprintf("P%d", len(rules))
		rules = append(rules, fmt.Sprintf(`(%s (param "%s"))`, kind, name))
		params = append(params, "-D", name+"="+filepath.Join(home, rel))
	}
	for _, d := range append(hiddenDirs(), macOnlyDirs...) {
		add("subpath", d)
	}
	for _, f := range sensitiveFiles {
		add("literal", f)
	}
	profile = "(version 1)\n(allow default)\n" +
		"(deny file-read* " + strings.Join(rules, " ") + ")\n" +
		`(deny mach-lookup (global-name "com.apple.SecurityServer") (global-name "com.apple.securityd.xpc"))` + "\n" +
		// Blocked outright rather than left to fail at the mach-lookup: denied
		// that way it still prints "could not be found", which go-keyring CLIs
		// (atlas) read as "the Keychain works, it's just empty" and never fall
		// back to their config file. Failing to exec, they do.
		`(deny process-exec (literal "/usr/bin/security"))` + "\n"
	return profile, params
}

func Check() Status { return Status{Ready: true} }

func Cmd(ctx context.Context, script string) (*exec.Cmd, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		// The profile is written in terms of absolute paths, so a half-populated
		// one protects nothing. Refuse rather than fall through to a bare shell.
		return nil, errors.New("cannot sandbox the shell: home directory is unknown")
	}
	profile, params := seatbelt(home)
	args := append(append([]string{"-p", profile}, params...), "sh", "-c", script)
	return exec.CommandContext(ctx, "sandbox-exec", args...), nil
}

func Command(ctx context.Context, env map[string]string, name string, args ...string) (*exec.Cmd, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = os.Environ()
	for k, v := range env {
		cmd.Env = append(cmd.Env, k+"="+v)
	}
	return cmd, nil
}

// ToShellPath is identity here: the shell and the app see the same filesystem.
func ToShellPath(p string) string { return p }

// Hide is a no-op: only Windows conjures a console window per child.
func Hide(cmd *exec.Cmd) *exec.Cmd { return cmd }

// Look reports whether a program is runnable, replacing bare exec.LookPath so
// the answer comes from wherever Command would actually run it.
func Look(ctx context.Context, name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}
