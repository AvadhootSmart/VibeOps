package skills

import (
	"encoding/json"
	"os"
	"path/filepath"
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
