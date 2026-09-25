package sessions

import (
	"os"
	"path/filepath"
	"testing"

	"VibeOps/backend/jsonstore"
)

// upsert holds the only branch worth checking: update-in-place vs append.
func TestUpsert(t *testing.T) {
	var all []SessionMeta
	all = upsert(all, SessionMeta{ID: "a", Name: "first"})
	all = upsert(all, SessionMeta{ID: "b", Name: "second"})
	if len(all) != 2 {
		t.Fatalf("two new ids should append: got %d", len(all))
	}
	all = upsert(all, SessionMeta{ID: "a", Name: "updated"})
	if len(all) != 2 {
		t.Fatalf("existing id must not grow the slice: got %d", len(all))
	}
	if all[0].Name != "updated" {
		t.Fatalf("existing id should be replaced: got %q", all[0].Name)
	}
}

// An id becomes a filename, so the traversal cases have to stay rejected.
func TestBodyPathRejectsNonIDs(t *testing.T) {
	for _, id := range []string{"", "../config", "a/b", `a\b`, "index.json"} {
		if got := bodyPath(id); got != "" {
			t.Errorf("bodyPath(%q) should be rejected, got %q", id, got)
		}
	}
	if bodyPath("abc-123") == "" {
		t.Error("a plain id should resolve")
	}
}

// The split has to carry an existing single-file store across without losing a
// chat, and the round trip has to keep working afterwards.
func TestMigrateThenRoundTrip(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(t.TempDir(), "cfg"))

	legacy := []Session{
		{ID: "one", Name: "First", Messages: `[{"id":"t"}]`, Updated: 100},
		{ID: "two", Name: "Second", Messages: `[]`, Updated: 200},
	}
	if err := jsonstore.Write(legacyPath(), legacy); err != nil {
		t.Fatal(err)
	}

	s := NewSessions()
	metas, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(metas) != 2 {
		t.Fatalf("both chats should survive the split: got %d", len(metas))
	}
	if metas[0].ID != "two" {
		t.Errorf("newest first: got %q", metas[0].ID)
	}
	if _, err := os.Stat(legacyPath()); !os.IsNotExist(err) {
		t.Error("the legacy file should be renamed aside, not left in place")
	}

	got, err := s.Get("one")
	if err != nil {
		t.Fatal(err)
	}
	if got.Messages != `[{"id":"t"}]` {
		t.Errorf("body lost in migration: %q", got.Messages)
	}

	// A second List must not re-run the migration and resurrect deleted chats.
	if err := s.Delete("one"); err != nil {
		t.Fatal(err)
	}
	metas, err = s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(metas) != 1 || metas[0].ID != "two" {
		t.Fatalf("delete should stick across a re-list: got %+v", metas)
	}

	if err := s.Save("three", "Third", `[1]`); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.Get("three"); got.Messages != `[1]` {
		t.Errorf("save/get round trip failed: %q", got.Messages)
	}
	if metas, _ = s.List(); len(metas) != 2 {
		t.Fatalf("index should hold two chats: got %d", len(metas))
	}
}
