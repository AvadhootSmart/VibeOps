// Package sessions persists chat sessions to disk as JSON. Like settings, it's
// privileged local storage exposed to the frontend as Wails bindings — not an
// AI tool. The message blob is opaque: the frontend stringifies its own turn
// list and Go just stores it, so the storage format never has to track the AI
// SDK's message types.
//
// Layout: one file per chat under sessions/, plus a small index.json holding
// just the metadata. Everything used to live in a single sessions.json, but a
// transcript carries every tool call's full output, so that file reached
// megabytes after a few dozen chats — and each of the two saves per turn read,
// re-serialised and rewrote all of it, while the sidebar reparsed all of it on
// every refresh. Split, a save costs one chat and a listing costs the index.
package sessions

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"VibeOps/backend/jsonstore"
)

// Session is one saved chat. Messages is opaque JSON (the frontend's turn list,
// stringified) — Go never parses it, it just round-trips the blob.
type Session struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Messages string `json:"messages"`
	Updated  int64  `json:"updated"`
}

// SessionMeta is a Session without its (potentially large) message blob, for
// listing in the sidebar without shipping every conversation to the webview.
type SessionMeta struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Updated int64  `json:"updated"`
}

type Sessions struct{}

func NewSessions() *Sessions { return &Sessions{} }

func configDir() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	return filepath.Join(dir, "VibeOps")
}

func sessionsDir() string { return filepath.Join(configDir(), "sessions") }
func indexPath() string   { return filepath.Join(sessionsDir(), "index.json") }

// legacyPath is the pre-split single file. Still read once, to migrate.
func legacyPath() string { return filepath.Join(configDir(), "sessions.json") }

// bodyPath resolves a session id to its file. Ids come from the frontend and
// end up as filenames, so anything that isn't plainly an id is rejected rather
// than escaping the sessions directory.
func bodyPath(id string) string {
	if id == "" || strings.ContainsAny(id, `/\.`) {
		return ""
	}
	return filepath.Join(sessionsDir(), id+".json")
}

// upsert replaces the meta with a matching ID, or appends it if new.
func upsert(all []SessionMeta, meta SessionMeta) []SessionMeta {
	for i := range all {
		if all[i].ID == meta.ID {
			all[i] = meta
			return all
		}
	}
	return append(all, meta)
}

// migrate splits a pre-split sessions.json into per-chat files the first time
// it's seen. The old file is renamed rather than deleted, so a bad split is
// recoverable by hand.
func migrate() error {
	legacy := legacyPath()
	if _, err := os.Stat(legacy); err != nil {
		return nil // already migrated, or nothing to migrate
	}
	all, err := jsonstore.Read[[]Session](legacy)
	if err != nil {
		return err
	}
	var index []SessionMeta
	for _, sess := range all {
		path := bodyPath(sess.ID)
		if path == "" {
			continue
		}
		if err := jsonstore.Write(path, sess); err != nil {
			return err
		}
		index = append(index, SessionMeta{ID: sess.ID, Name: sess.Name, Updated: sess.Updated})
	}
	if err := jsonstore.Write(indexPath(), index); err != nil {
		return err
	}
	return os.Rename(legacy, legacy+".migrated")
}

// List returns session metadata, newest first (no message bodies).
func (s *Sessions) List() ([]SessionMeta, error) {
	if err := migrate(); err != nil {
		return nil, err
	}
	metas, err := jsonstore.Read[[]SessionMeta](indexPath())
	if err != nil {
		return nil, err
	}
	sort.Slice(metas, func(i, j int) bool { return metas[i].Updated > metas[j].Updated })
	return metas, nil
}

// Get returns one session's full contents; a missing id yields the zero value.
func (s *Sessions) Get(id string) (Session, error) {
	if err := migrate(); err != nil {
		return Session{}, err
	}
	path := bodyPath(id)
	if path == "" {
		return Session{}, nil
	}
	return jsonstore.Read[Session](path)
}

// Save writes the session body and stamps it as most recently updated in the
// index. The body goes first: an index entry pointing at a file that isn't
// there yet would show an empty chat in the sidebar.
func (s *Sessions) Save(id, name, messages string) error {
	if err := migrate(); err != nil {
		return err
	}
	path := bodyPath(id)
	if path == "" {
		return nil
	}
	meta := SessionMeta{ID: id, Name: name, Updated: time.Now().Unix()}
	if err := jsonstore.Write(path, Session{ID: id, Name: name, Messages: messages, Updated: meta.Updated}); err != nil {
		return err
	}
	return jsonstore.Edit(indexPath(), func(all []SessionMeta) []SessionMeta {
		return upsert(all, meta)
	})
}

// Delete removes a session by id; a missing id is a no-op.
func (s *Sessions) Delete(id string) error {
	if err := migrate(); err != nil {
		return err
	}
	path := bodyPath(id)
	if path == "" {
		return nil
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return jsonstore.Edit(indexPath(), func(all []SessionMeta) []SessionMeta {
		out := all[:0]
		for _, meta := range all {
			if meta.ID != id {
				out = append(out, meta)
			}
		}
		return out
	})
}
