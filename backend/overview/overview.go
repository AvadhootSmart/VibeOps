// Package overview persists the server overview the AI agent generates. The
// agent SSHes into the connected server, snapshots the running services, then
// calls GenerateOverview with the result — Go just stores it as JSON and pings
// the frontend so the Overview screen refreshes. Like sessions, it's privileged
// local storage exposed as Wails bindings; GenerateOverview is also wired up as
// an AI tool so the agent can write the overview itself.
package overview

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"VibeOps/backend/jsonstore"
)

// App is one service the agent found — either running on the SSH server or
// pulled from a connector (e.g. Vercel). Only facts that stay true between
// snapshots: times are absolute so the screen can age them itself, and there is
// no CPU/memory because a one-off reading of those is stale by the next glance.
type App struct {
	Name        string `json:"name"`        // service/app name, e.g. "postgres"
	Provider    string `json:"provider"`    // where it came from: the server name, or a connector name like "vercel"
	Kind        string `json:"kind"`        // what it is: "API" | "frontend" | "App"
	Domain      string `json:"domain"`      // public domain if exposed, else "internal · <port>"
	Status      string `json:"status"`      // running | deploying | failed
	Since       string `json:"since"`       // RFC 3339: when it started (server) or last deployed (connector), "" if unknown
	CertExpires string `json:"certExpires"` // RFC 3339 TLS expiry of Domain, "" if not checked or platform-managed
}

// Host is one SSH server the snapshot read.
type Host struct {
	Name        string `json:"name"`        // matches App.Provider
	OS          string `json:"os"`          // e.g. "Ubuntu 24.04"
	BootedAt    string `json:"bootedAt"`    // RFC 3339, "" if unknown
	DiskUsedPct int    `json:"diskUsedPct"` // root filesystem, 0–100
	DiskSize    string `json:"diskSize"`    // e.g. "80G"
}

// Data is the whole overview. A zero UpdatedAt means nothing was ever
// snapshotted, which the screen renders as the empty state.
type Data struct {
	Summary   string `json:"summary"`   // one-line header, e.g. "6 services running · all healthy"
	Insight   string `json:"insight"`   // the "VibeOps noticed" note, plain text
	Hosts     []Host `json:"hosts"`     // SSH servers snapshotted
	Apps      []App  `json:"apps"`      // services on those servers plus connector apps
	UpdatedAt int64  `json:"updatedAt"` // unix seconds, stamped on write
}

type Overview struct{}

func NewOverview() *Overview { return &Overview{} }

// eventCtx is the Wails runtime context for emitting refresh events; set once
// at startup. ponytail: package-level, fine for a single window.
var eventCtx context.Context

// SetEventCtx wires the runtime context. Call from the app's OnStartup.
func SetEventCtx(ctx context.Context) { eventCtx = ctx }

func overviewPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	return filepath.Join(dir, "VibeOps", "overview.json")
}

// Get returns the stored overview; a missing file yields the zero value (which
// the screen shows as the empty state).
func (o *Overview) Get() (Data, error) {
	return jsonstore.Read[Data](overviewPath())
}

// GenerateOverview stores the AI-generated overview (JSON matching Data) and
// pings the frontend to refresh. This is the tool the agent calls after it
// SSHes in and snapshots the server's services.
func (o *Overview) GenerateOverview(data string) error {
	var d Data
	if err := json.Unmarshal([]byte(data), &d); err != nil {
		return err
	}
	d.UpdatedAt = time.Now().Unix()
	if err := jsonstore.Write(overviewPath(), d); err != nil {
		return err
	}
	if eventCtx != nil {
		runtime.EventsEmit(eventCtx, "overview:updated")
	}
	return nil
}
