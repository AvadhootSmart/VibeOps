package tools

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"VibeOps/backend/settings"
)

// Secret bridge for the harness providers. A tool call the model makes lands
// in a separate `vibeops mcp` child process (backend/mcp) that can't reach the
// app's dialog, so collecting a secret from the user is brokered over two
// shared channels: the child writes a secret-request file this app watches, and
// the answer comes back through the OS keychain. The value never passes through
// the model. The full flow is documented in docs/secret-request-flow.md.

// secretRequest is what the mcp child writes; nonce ties it to one harness run
// so a foreign process can't spuriously pop the dialog.
type secretRequest struct {
	Nonce  string `json:"nonce"`
	Name   string `json:"name"`   // "sudo", or an env var name like DATABASE_URL
	Reason string `json:"reason"` // shown to the user so they know what they're handing over
}

// newNonce returns a random per-run token passed to the child via env.
func newNonce() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// watchSecretRequest polls for a secret-request file matching nonce for the life
// of ctx (one harness run) and emits "secret:request" so the frontend pops the
// dialog. It prompts once per file and waits for the frontend to answer
// (ResolveSecret deletes the file) before it will emit again.
// ponytail: 250ms poll, no fsnotify dep — it's a single file.
func watchSecretRequest(ctx context.Context, nonce string) {
	path := settings.SecretRequestPath()
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	emitted := false
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		data, err := os.ReadFile(path)
		if err != nil {
			emitted = false // file gone/answered — ready for the next request
			continue
		}
		if emitted {
			continue // already prompted for this file; awaiting ResolveSecret
		}
		var req secretRequest
		if json.Unmarshal(data, &req) != nil || req.Nonce != nonce {
			continue
		}
		if eventCtx != nil {
			runtime.EventsEmit(eventCtx, "secret:request", req.Name, req.Reason)
		}
		emitted = true
	}
}

// ResolveSecret is called by the frontend after the user answers the secret
// dialog. A non-empty value is stored in the keychain for the mcp child to read;
// an empty value means the user declined. Either way the request file is
// deleted, which acks the prompt and unblocks the child's poll. Setting the
// keychain before deleting the file avoids a race where the child sees the file
// gone with no value.
func (h *Harness) ResolveSecret(name string, value string) error {
	if value != "" {
		if err := settings.SetSecret(name, value); err != nil {
			return err
		}
	}
	return os.Remove(settings.SecretRequestPath())
}

// SetRunSecret is the OpenRouter path's counterpart to ResolveSecret. Its tools
// run in the webview, so there is no mcp child and no request file — but the
// value still goes to the same run-scoped keychain store, because that is where
// ShellAccess and RunRemote read it from. Deliberately write-only: there is no
// Get binding, so a value can be handed in from the webview and never read back
// out of it.
func (t *Tool) SetRunSecret(name string, value string) error {
	if !settings.ValidSecretName(name) {
		return fmt.Errorf("invalid secret name %q: letters, digits and underscores only", name)
	}
	return settings.SetSecret(name, value)
}

// ClearRunSecrets drops every held value. The OpenRouter path calls it at the
// start of each turn so the model can't inherit a prior turn's authentication
// or approval; the harness paths defer it per run (see Harness.Run).
func (t *Tool) ClearRunSecrets() error {
	startTurn()
	return settings.ClearSecrets()
}
