// Package errlog keeps error.log: what went wrong on a user's machine, for them
// to send us when they report a bug.
package errlog

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"VibeOps/backend/settings"
)

const maxSize = 1 << 20

// Build is stamped on every line, since the log outlives the version that
// wrote it. Set once from main.
var Build string

var mu sync.Mutex

func Path() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	return filepath.Join(dir, "VibeOps", "error.log")
}

// Write appends one entry. The file is shared with users, so held secrets and
// the OpenRouter key are redacted first. Past maxSize the log rolls over to
// error.log.1, keeping at most two files.
func Write(source, message string) {
	message = settings.Redact(strings.TrimSpace(message))
	if key, _ := settings.NewSettings().GetAPIKey(); len(key) >= 4 {
		message = strings.ReplaceAll(message, key, "[openrouter key]")
	}
	// Continuation lines are indented so each entry starts at column 0.
	message = strings.ReplaceAll(message, "\n", "\n    ")

	mu.Lock()
	defer mu.Unlock()
	path := Path()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return
	}
	if fi, err := os.Stat(path); err == nil && fi.Size() > maxSize {
		os.Rename(path, path+".1")
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s v%s %s/%s [%s] %s\n", time.Now().Format(time.RFC3339),
		Build, runtime.GOOS, runtime.GOARCH, source, message)
}

// Reveal shows error.log in Finder, or its folder in Explorer, so the user can
// attach it to a report. Windows gets the folder because Go quotes the whole
// "/select,<path>" argument, which Explorer misreads when the path has spaces.
func Reveal() error {
	path := Path()
	if runtime.GOOS == "windows" {
		dir := filepath.Dir(path)
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return err
		}
		return exec.Command("explorer", dir).Start()
	}
	if _, err := os.Stat(path); err != nil {
		os.MkdirAll(filepath.Dir(path), 0o700)
		return exec.Command("open", filepath.Dir(path)).Start()
	}
	return exec.Command("open", "-R", path).Start()
}
