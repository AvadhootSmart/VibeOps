package shell

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// Quote guards the secret-substitution boundary: a value the model never gets to
// see is pasted into a command it wrote, so a value that can terminate its own
// quoting can rewrite the command.
func TestQuote(t *testing.T) {
	for in, want := range map[string]string{
		"plain":           `'plain'`,
		"two words":       `'two words'`,
		"$HOME":           `'$HOME'`,
		`it's`:            `'it'\''s'`,
		"a'; rm -rf /; b": `'a'\''; rm -rf /; b'`,
		`"double"`:        `'"double"'`,
		"back`tick`":      "'back`tick`'",
		"new\nline":       "'new\nline'",
	} {
		if got := Quote(in); got != want {
			t.Errorf("Quote(%q) = %s, want %s", in, got, want)
		}
	}
}

func TestWinToShellPath(t *testing.T) {
	for in, want := range map[string]string{
		`C:\Users\x\VibeOps`: "/mnt/c/Users/x/VibeOps",
		`D:\repos`:           "/mnt/d/repos",
		`c:\lower`:           "/mnt/c/lower",
		`C:`:                 "/mnt/c",
		`C:\`:                "/mnt/c/",
		"/already/posix":     "/already/posix",
		`relative\path`:      "relative/path",
	} {
		if got := winToShellPath(in); got != want {
			t.Errorf("winToShellPath(%q) = %q, want %q", in, got, want)
		}
	}
}

// A credential file must be unreadable from the model's shell while the rest of
// the home stays usable. Runs against a fake home so it needs no real ~/.npmrc.
func TestCmdHidesCredentialFiles(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the Windows home is read from USERPROFILE and crosses into WSL")
	}
	if s := Check(); !s.Ready {
		t.Skipf("sandbox prerequisites missing: %s", s.Message)
	}
	// Resolved because seatbelt matches the real path, and macOS temp dirs sit
	// behind the /var -> /private/var symlink.
	home, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("HOME", home)
	for name, body := range map[string]string{".npmrc": "//registry/:_authToken=leaked", "notes": "fine"} {
		if err := os.WriteFile(filepath.Join(home, name), []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	run := func(script string) string {
		cmd, err := Cmd(context.Background(), script)
		if err != nil {
			t.Fatal(err)
		}
		out, _ := cmd.CombinedOutput()
		return string(out)
	}
	if out := run("cat " + Quote(filepath.Join(home, ".npmrc"))); strings.Contains(out, "leaked") {
		t.Fatalf("~/.npmrc readable inside the sandbox: %q", out)
	}
	if out := run("cat " + Quote(filepath.Join(home, "notes"))); !strings.Contains(out, "fine") {
		t.Fatalf("ordinary file in home unreadable: %q", out)
	}
}
