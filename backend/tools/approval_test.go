package tools

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"VibeOps/backend/ask"
	"VibeOps/backend/shell"
)

// Every other test in the package runs commands without a window to ask in.
func init() { confirm = func(ask.Question) (string, error) { return optRun, nil } }

// answering stubs the dialog with a fixed answer and counts how often it opened.
func answering(t *testing.T, answer string) *int {
	t.Helper()
	asked := 0
	prev := confirm
	confirm = func(ask.Question) (string, error) { asked++; return answer, nil }
	t.Cleanup(func() { confirm = prev; startTurn() })
	startTurn()
	return &asked
}

func TestApprovalGate(t *testing.T) {
	if s := shell.Check(); !s.Ready {
		t.Skipf("sandbox prerequisites missing: %s", s.Message)
	}
	tool := NewTools()
	probe := filepath.Join(t.TempDir(), "probe")
	touch := "touch " + shell.ToShellPath(probe)

	t.Run("denied command never starts", func(t *testing.T) {
		answering(t, optDeny)
		if _, err := tool.ShellAccess(touch, ""); err == nil {
			t.Fatal("denied command reported success")
		}
		if _, err := os.Stat(probe); !os.IsNotExist(err) {
			t.Fatal("denied command ran anyway")
		}
	})

	t.Run("typed answer is a refusal carrying the user's words", func(t *testing.T) {
		answering(t, "use the staging box instead")
		_, err := tool.ShellAccess(touch, "")
		if err == nil || !strings.Contains(err.Error(), "staging box") {
			t.Fatalf("want refusal quoting the user, got %v", err)
		}
	})

	t.Run("run everything skips the next prompt until the turn ends", func(t *testing.T) {
		asked := answering(t, optAll)
		for range 2 {
			if _, err := tool.ShellAccess("true", ""); err != nil {
				t.Fatal(err)
			}
		}
		if *asked != 1 {
			t.Fatalf("asked %d times, want 1", *asked)
		}
		tool.ClearRunSecrets()
		tool.ShellAccess("true", "")
		if *asked != 2 {
			t.Fatal("approval outlived the turn")
		}
	})

	t.Run("plan approval carries into the next turn only", func(t *testing.T) {
		asked := answering(t, optRun)
		tool.ApproveNextTurn()
		tool.ClearRunSecrets()
		tool.ShellAccess("true", "")
		if *asked != 0 {
			t.Fatal("approved plan still prompted")
		}
		tool.ClearRunSecrets()
		tool.ShellAccess("true", "")
		if *asked != 1 {
			t.Fatal("plan approval leaked into a later turn")
		}
	})
}
