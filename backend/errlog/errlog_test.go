package errlog

import (
	"os"
	"strings"
	"testing"
)

func TestWriteFormatsAndRollsOver(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("HOME", dir)
	t.Setenv("APPDATA", dir)
	Build = "9.9.9"

	Write("connector", "Failed to install neon: exit 1\nnpm ERR! boom")
	b, _ := os.ReadFile(Path())
	if !strings.Contains(string(b), "v9.9.9") || !strings.Contains(string(b), "[connector]") ||
		!strings.Contains(string(b), "\n    npm ERR! boom") {
		t.Fatalf("unexpected entry:\n%s", b)
	}

	os.WriteFile(Path(), make([]byte, maxSize+1), 0o600)
	Write("app", "after roll")
	if _, err := os.Stat(Path() + ".1"); err != nil {
		t.Fatal("full log was not rolled over")
	}
	if fi, _ := os.Stat(Path()); fi.Size() > 200 {
		t.Fatal("new log did not start fresh")
	}
}
