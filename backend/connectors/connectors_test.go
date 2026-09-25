package connectors

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"VibeOps/backend/skills"
)

// The whole point of the split: opening a screen reads the cache, it never
// asks a CLI — for neon and supabase, asking is a browser login flow.
func TestCheckAllReportsCachedAuthOnly(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	s := NewConnectors()

	cold, err := s.CheckAll()
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range cold {
		if c.Checked {
			t.Fatalf("%s reported a sign-in result nobody asked for", c.Name)
		}
	}

	if err := rememberAuth("vercel", true); err != nil {
		t.Fatal(err)
	}
	warm, err := s.CheckAll()
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range warm {
		want := c.Name == "vercel"
		if c.Checked != want || c.Authenticated != want {
			t.Fatalf("%s: checked=%v authenticated=%v, want %v", c.Name, c.Checked, c.Authenticated, want)
		}
	}
}

// A CLI the user installed themselves never goes through Install, so a sign-in
// check that finds it authenticated is what ships its skill.
func TestCheckAuthInstallsSkillWhenSignedIn(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the fake CLI is a shell script, and Windows runs it inside WSL")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	skills.Packaged = os.DirFS("../../.agents/skills")

	bin := t.TempDir()
	if err := os.WriteFile(filepath.Join(bin, "wrangler"), []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))

	status, err := NewConnectors().CheckAuth("wrangler")
	if err != nil || !status.Authenticated {
		t.Fatalf("status=%+v err=%v", status, err)
	}
	if _, err := os.Stat(filepath.Join(home, ".agents", "skills", "cloudflare", "SKILL.md")); err != nil {
		t.Fatalf("skill not installed: %v", err)
	}
}
