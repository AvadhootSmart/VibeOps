package tools

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"VibeOps/backend/shell"
)

// The guard is only meaningful if it survives the tricks a model would actually
// reach for, so this exercises the real ShellAccess path rather than inspecting
// the profile string.
//
// It deliberately runs on every platform. The previous version skipped unless
// GOOS was darwin, which meant the two platforms where the sandbox is newest —
// and most likely to be wrong — reported green with zero coverage.
func TestShellAccessBlocksCredentialStores(t *testing.T) {
	if s := shell.Check(); !s.Ready {
		t.Skipf("sandbox prerequisites missing, cannot verify the guard: %s", s.Message)
	}
	tool := NewTools()

	// A guard that also breaks ordinary ops work would just get turned off.
	if out, err := tool.ShellAccess(`echo alive`, ""); err != nil || !strings.Contains(out, "alive") {
		t.Fatalf("normal command broke under sandbox: out=%q err=%v", out, err)
	}

	// Whatever the host actually keeps in ~/.ssh is the probe: it proves the
	// mount hides real contents, not just that the path reads as empty. On
	// Windows the app's home is the Windows one, which the distro sees under
	// /mnt/c — the path the sandbox is told to blank.
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatal(err)
	}
	sshDir := filepath.Join(home, ".ssh")
	entries, err := os.ReadDir(sshDir)
	if err != nil || len(entries) == 0 {
		t.Log("host has no ~/.ssh contents to hide; relying on the platform probes below")
	}
	for _, e := range entries {
		out, _ := tool.ShellAccess("ls -a "+shell.ToShellPath(sshDir), "")
		if strings.Contains(out, e.Name()) {
			t.Errorf("~/.ssh/%s was visible inside the sandbox:\n%s", e.Name(), out)
		}
	}

	// Asserted on exit status, not on the error text: tools disagree about how
	// they report EPERM (macOS base64 calls a denied read "invalid argument"),
	// but none of them exit 0 without the bytes.
	probes := []string{
		`cat ~/.ssh/id_rsa ~/.ssh/id_ed25519`,
		`python3 -c 'import os; print(open(os.path.expanduser("~/.ssh/id_rsa")).read())'`,
	}
	if runtime.GOOS == "darwin" {
		// ~/Library/Keychains exists on every mac, so a denial reads as EPERM and
		// can't be confused with ENOENT.
		probes = append(probes,
			`ls ~/Library/Keychains`,
			`base64 ~/Library/Keychains/login.keychain-db`,
			`security find-generic-password -s VibeOps -a openrouter-api-key -w`)
	}
	for _, script := range probes {
		if out, err := tool.ShellAccess(script, ""); err == nil {
			t.Errorf("credential store was readable via %q:\n%s", script, out)
		}
	}
}
