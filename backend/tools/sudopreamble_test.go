package tools

import (
	"strings"
	"testing"
)

// The leak this guards against is ordering, so that is what gets asserted: sudo
// must consume stdin before anything the model wrote can run, and stdin must be
// gone by the time it does.
func TestSudoPreambleSpendsPasswordFirst(t *testing.T) {
	const capture = "head -1 > /tmp/p; sudo true"
	got := sudoPreamble(capture)

	sudo := strings.Index(got, "sudo -S -p '' -v")
	closed := strings.Index(got, "exec 0</dev/null")
	model := strings.Index(got, capture)

	if sudo < 0 || closed < 0 || model < 0 {
		t.Fatalf("preamble missing a stage:\n%s", got)
	}
	if !(sudo < closed && closed < model) {
		t.Errorf("stages out of order (sudo=%d closed=%d model=%d); the model's command could read the password:\n%s", sudo, closed, model, got)
	}
}

func TestSudoPreambleStopsOnBadPassword(t *testing.T) {
	got := sudoPreamble("rm -rf /var/log/app")
	if !strings.Contains(got, "exit 1") {
		t.Error("failed auth must abort; otherwise the command runs unprivileged and its damage is silent")
	}
	if strings.Index(got, "exit 1") > strings.Index(got, "rm -rf") {
		t.Error("abort must come before the model's command")
	}
}

// The password is never part of the string handed to the remote shell — that is
// what keeps it out of ps and shell history.
func TestSudoPreambleCarriesNoSecret(t *testing.T) {
	if strings.Contains(sudoPreamble("sudo apt update"), "-p ''  ") {
		t.Error("prompt flag should stay empty")
	}
	for _, s := range []string{"password", "PASS", "hunter2"} {
		if strings.Contains(sudoPreamble("sudo apt update"), s) {
			t.Errorf("preamble should be secret-free, found %q", s)
		}
	}
}

// The model's command must never be the last statement. A shell with nothing
// left to do exec()s it in place, which reparents sudo onto sshd and loses the
// credential -v cached against this shell's pid — the intermittent
// "a terminal is required to read the password" this preamble exists to avoid.
func TestSudoPreambleKeepsShellAlive(t *testing.T) {
	const cmd = "sudo certbot --nginx -d example.com"
	got := sudoPreamble(cmd)
	after := strings.TrimSpace(got[strings.Index(got, cmd)+len(cmd):])
	if after == "" {
		t.Fatalf("model command is last; the shell will exec it and sudo loses its parent:\n%s", got)
	}
	if !strings.Contains(after, "$?") {
		t.Errorf("trailing statement must carry the command's exit status, got %q", after)
	}
}
