package tools

import "testing"

// Quitting mid-run must cancel every registered run, not just the newest — a
// missed one is a wsl.exe (and the CLI behind it) left alive after the app is
// gone.
func TestCancelAllCancelsEveryRun(t *testing.T) {
	a, doneA := startRun("a")
	b, doneB := startRun("b")
	defer doneA()
	defer doneB()

	CancelAll()

	for name, ctx := range map[string]interface{ Err() error }{"a": a, "b": b} {
		if ctx.Err() == nil {
			t.Errorf("run %q still live after CancelAll", name)
		}
	}
}

// CancelAll must not deadlock against done()'s own lock, and must leave the
// map clean.
func TestCancelAllLeavesNoEntries(t *testing.T) {
	_, done := startRun("x")
	CancelAll()
	done()

	runsMu.Lock()
	defer runsMu.Unlock()
	if len(runs) != 0 {
		t.Errorf("runs map leaked %d entries", len(runs))
	}
}
