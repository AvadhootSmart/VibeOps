// Package jsonstore is a tiny helper for persisting a value as JSON on disk.
// It lives in backend/ (not tools or settings) so any package can use it
// without an import cycle.
//
// Usage:
//
//	type config struct {
//		Model string `json:"model"`
//	}
//	path := "/path/to/config.json"
//
//	// Read (missing file → zero value, no error)
//	c, err := jsonstore.Read[config](path)
//
//	// Write (atomic, creates parent dirs)
//	err = jsonstore.Write(path, config{Model: "opus"})
//
//	// Edit (read-modify-write in one call)
//	err = jsonstore.Edit(path, func(c config) config {
//		c.Model = "sonnet"
//		return c
//	})
package jsonstore

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"time"
)

// Read decodes the JSON file at path into a value of type T. A missing file
// yields the zero value and no error, so callers can treat "not written yet"
// as "empty".
func Read[T any](path string) (T, error) {
	var v T
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return v, nil
	}
	if err != nil {
		return v, err
	}
	if len(data) == 0 {
		return v, nil
	}
	err = json.Unmarshal(data, &v)
	return v, err
}

// Write encodes v as indented JSON and writes it to path, creating parent
// directories as needed. The write is atomic (temp file + rename) so a crash
// mid-write can't corrupt the file.
//
// ponytail: the 0o600 is a no-op on Windows, which ignores Unix modes — the
// secret-request file is not ACL-restricted there. Needs a real DACL to match
// the intent.
func Write[T any](path string, v T) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}

	// Windows fails the rename with a sharing violation if anyone else has the
	// destination open, and the secret bridge puts two processes on these files
	// by design — the app polls every 250ms while the mcp child writes. The
	// holder is a reader that closes immediately, so a brief retry clears it.
	var rerr error
	for i := range 4 {
		if rerr = os.Rename(tmp, path); rerr == nil {
			return nil
		}
		time.Sleep(time.Duration(i+1) * 25 * time.Millisecond)
	}
	return rerr
}

// Edit reads the file, applies fn to the decoded value, and writes it back.
// fn receives the current value (zero value if the file is absent).
func Edit[T any](path string, fn func(T) T) error {
	v, err := Read[T](path)
	if err != nil {
		return err
	}
	return Write(path, fn(v))
}
