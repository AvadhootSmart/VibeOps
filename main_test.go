package main

import "testing"

// Runs on a developer's mac, which is the point: %SystemRoot% is set explicitly
// so the Windows-only branch is exercised on the machine the code is written on
// rather than only on the one where a bad match would strand the agent in
// System32.
func TestUnderSystemRoot(t *testing.T) {
	t.Setenv("SystemRoot", `C:\Windows`)

	cases := map[string]bool{
		`C:\Windows\System32`: true,
		`C:\Windows`:          true,
		`c:\windows\system32`: true,
		`C:\WindowsApps`:      false,
		`C:\Users\x`:          false,
		`C:\Win`:              false,
	}
	for wd, want := range cases {
		if got := underSystemRoot(wd); got != want {
			t.Errorf("underSystemRoot(%q) = %v, want %v", wd, got, want)
		}
	}
}

func TestUnderSystemRootUnsetIsAlwaysFalse(t *testing.T) {
	t.Setenv("SystemRoot", "")
	if underSystemRoot("/Users/x") {
		t.Error("no SystemRoot should mean no system root, so every path is outside it")
	}
}
