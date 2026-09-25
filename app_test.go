package main

import "testing"

func TestRepoFolder(t *testing.T) {
	ok := map[string]string{
		"https://github.com/you/my-app":     "my-app",
		"https://github.com/you/my-app.git": "my-app",
		"https://github.com/you/my-app/":    "my-app",
		"git@github.com:you/my-app.git":     "my-app",
	}
	for url, want := range ok {
		got, err := repoFolder(url)
		if err != nil || got != want {
			t.Errorf("repoFolder(%q) = %q, %v; want %q", url, got, err, want)
		}
	}
	// Must never escape the workspaces folder.
	for _, url := range []string{"", "/", "https://github.com/you/..", "..", "."} {
		if got, err := repoFolder(url); err == nil {
			t.Errorf("repoFolder(%q) = %q; want error", url, got)
		}
	}
}
