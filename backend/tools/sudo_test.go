package tools

import "testing"

// The regex is the message, not the boundary (see localSudo), so this checks it
// catches the shapes a model actually writes without firing on words that
// merely contain "sudo".
func TestLocalSudoMatches(t *testing.T) {
	blocked := []string{
		"sudo apt install nginx",
		"echo hi && sudo systemctl restart nginx",
		"ls | sudo tee /etc/hosts",
	}
	for _, s := range blocked {
		if !localSudo.MatchString(s) {
			t.Errorf("localSudo missed %q", s)
		}
	}

	allowed := []string{
		"ls ~/sudoku",
		"grep pseudo notes.txt",
		"echo nosudo",
	}
	for _, s := range allowed {
		if localSudo.MatchString(s) {
			t.Errorf("localSudo fired on %q, which is not an elevation attempt", s)
		}
	}
}

func TestShellAccessRejectsSudo(t *testing.T) {
	out, err := (&Tool{}).ShellAccess("sudo apt install nginx", "")
	if err == nil {
		t.Fatal("sudo reached the shell; the sandbox would have failed it with an unreadable sudo.conf error")
	}
	if out != "" {
		t.Errorf("expected no output, got %q", out)
	}
}
