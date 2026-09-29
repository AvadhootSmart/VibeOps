package skills

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

// A nil slice marshals to `null`, which crashed the frontend's `skills.length`
// in packaged builds where the skills dir doesn't exist. Chdir to a temp dir to
// guarantee that case.
func TestListMarshalsToArrayWhenEmpty(t *testing.T) {
	t.Chdir(t.TempDir())

	got := NewSkills().List()
	if got == nil {
		t.Fatal("List() returned nil; frontend reads .length off it")
	}
	if b, _ := json.Marshal(got); string(b) != "[]" {
		t.Fatalf("marshalled to %s, want []", b)
	}
}

// Install writes the whole subtree, not just SKILL.md, and overwrites whatever
// occupied the destination — including the symlink the old layout left there.
func TestInstallCopiesPackagedSkill(t *testing.T) {
	t.Chdir(t.TempDir())
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	Packaged = fstest.MapFS{
		"cloudflare/SKILL.md":         {Data: []byte("---\nname: cloudflare\n---\nbody")},
		"cloudflare/references/kv.md": {Data: []byte("kv")},
		"vercel/SKILL.md":             {Data: []byte("---\nname: vercel\n---\n")},
	}
	t.Cleanup(func() { Packaged = nil })

	dest := InstallDir("cloudflare")
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(t.TempDir(), dest); err != nil {
		t.Fatal(err)
	}

	if err := Install("cloudflare"); err != nil {
		t.Fatalf("Install: %v", err)
	}
	for _, f := range []string{"SKILL.md", "references/kv.md"} {
		if _, err := os.Stat(filepath.Join(dest, filepath.FromSlash(f))); err != nil {
			t.Errorf("missing %s: %v", f, err)
		}
	}
	if _, err := os.Stat(InstallDir("vercel")); err == nil {
		t.Error("Install copied a skill it was not asked for")
	}
	if err := Install("nope"); err == nil {
		t.Error("Install of an unknown skill should fail")
	}
}

// Skills were renamed with a vibeops- prefix; the unprefixed copy an earlier
// VibeOps installed goes, a user's own skill of that name stays.
func TestRemoveLegacyOnlyTakesOurOldCopy(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	Packaged = os.DirFS("../../.agents/skills")

	body, err := fs.ReadFile(Packaged, "vibeops-neon/SKILL.md")
	if err != nil {
		t.Fatal(err)
	}
	ours := filepath.Join(home, ".agents", "skills", "neon")
	theirs := filepath.Join(home, ".agents", "skills", "vercel")
	for dir, md := range map[string]string{
		ours:   strings.Replace(string(body), "name: vibeops-neon", "name: neon", 1),
		theirs: "---\nname: vercel\ndescription: my own notes\n---\n",
	} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte(md), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	RemoveLegacy("neon", "vibeops-neon")
	RemoveLegacy("vercel", "vibeops-vercel")
	if _, err := os.Stat(ours); !os.IsNotExist(err) {
		t.Fatalf("old VibeOps copy survived: %v", err)
	}
	if _, err := os.Stat(theirs); err != nil {
		t.Fatalf("user's own skill was removed: %v", err)
	}
}

// Dev skills that live beside the shipped ones (ai-elements) never reach a
// user's agent.
func TestListOnlyShipsVibeOpsSkills(t *testing.T) {
	t.Chdir(t.TempDir())
	Packaged = fstest.MapFS{
		"vibeops-vercel/SKILL.md": {Data: []byte("---\nname: vibeops-vercel\n---\n")},
		"ai-elements/SKILL.md":    {Data: []byte("---\nname: ai-elements\n---\n")},
	}
	t.Cleanup(func() { Packaged = nil })
	got := NewSkills().List()
	if len(got) != 1 || got[0].Name != "vibeops-vercel" {
		t.Fatalf("List = %+v, want only vibeops-vercel", got)
	}
}
