package settings

import (
	"os/exec"
	"strings"
	"testing"
)

// The secret boundary has exactly two jobs: a value must reach the shell intact
// and unable to escape its argument, and it must not come back out in output.
// These check both against the real shell.
func TestInjectQuotesSafely(t *testing.T) {
	nasty := map[string]string{
		"SIMPLE": "hunter2",
		"SPACES": "two words",
		"QUOTE":  `it's a "value"`,
		"SHELL":  "$(touch /tmp/vibeops-pwned); rm -rf /; `whoami`",
		"DOLLAR": "pa$$word",
	}
	for name, want := range nasty {
		cmd := injectInto("printf %s $SECRET_"+name, nasty)
		got, err := exec.Command("sh", "-c", cmd).Output()
		if err != nil {
			t.Fatalf("%s: %v (cmd: %s)", name, err, cmd)
		}
		if string(got) != want {
			t.Errorf("%s: shell saw %q, want %q (cmd: %s)", name, got, want, cmd)
		}
	}
}

func TestInjectLeavesUnknownNames(t *testing.T) {
	got := injectInto("echo $SECRET_NOPE", map[string]string{"YES": "x"})
	if got != "echo $SECRET_NOPE" {
		t.Errorf("unknown name should pass through, got %q", got)
	}
}

// An unresolved placeholder must fail the command rather than reach the shell,
// because the shell does not treat it as an error — it expands an unset
// variable to the empty string and exits 0. This asserts that premise first,
// since it is the whole reason the guard exists.
func TestUnresolvedPlaceholderIsRefused(t *testing.T) {
	m := map[string]string{"YES": "x"}

	passedThrough := injectInto("$SECRET_NOPE", m)
	out, err := exec.Command("sh", "-c", "printf %s "+passedThrough).Output()
	if err != nil || string(out) != "" {
		t.Fatalf("premise changed: shell gave %q, err %v", out, err)
	}

	if _, err := injectChecked("wrangler secret put X --text $SECRET_NOPE", m); err == nil {
		t.Error("unresolved placeholder must fail the command, not run with an empty value")
	}
	if _, err := injectChecked("echo $SECRET_YES", m); err != nil {
		t.Errorf("resolved placeholder must still run: %v", err)
	}
}

func TestRedact(t *testing.T) {
	m := map[string]string{"DB_URL": "postgres://u:pw@host/db", "PIN": "12"}

	out := redactWith("connected to postgres://u:pw@host/db ok", m)
	if strings.Contains(out, "postgres://") {
		t.Errorf("value survived redaction: %q", out)
	}
	if out != "connected to $SECRET_DB_URL ok" {
		t.Errorf("got %q", out)
	}

	// Short values are skipped so they can't shred unrelated output.
	if got := redactWith("12 files, 128 MB", m); got != "12 files, 128 MB" {
		t.Errorf("short value should not redact, got %q", got)
	}
}

func TestValidSecretName(t *testing.T) {
	for _, ok := range []string{"sudo", "DATABASE_URL", "a1"} {
		if !ValidSecretName(ok) {
			t.Errorf("%q should be valid", ok)
		}
	}
	// A name that can't round-trip through $SECRET_<NAME> must be rejected, or
	// the value would be unreachable at best and mis-substituted at worst.
	for _, bad := range []string{"", "has space", "semi;colon", "$(x)", "a-b"} {
		if ValidSecretName(bad) {
			t.Errorf("%q should be invalid", bad)
		}
	}
}
