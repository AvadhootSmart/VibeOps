// Package connectors drives the deploy-target CLIs VibeOps can install and
// authenticate on the user's behalf (wrangler, vercel, neon, supabase). It is
// split from backend/settings because none of this is configuration: it shells
// out, installs npm packages, and runs interactive login flows. Settings only
// ever reads and writes local state.
//
// The agent-harness CLIs (claude, cursor-agent, opencode) are NOT here: VibeOps
// neither installs nor logs those in, and detecting them belongs next to the
// code that runs them — see tools.Harness.Check.
package connectors

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"VibeOps/backend/jsonstore"
	"VibeOps/backend/shell"
	"VibeOps/backend/skills"
)

type connector struct {
	Name        string
	DisplayName string
	// Login/AuthCheck default to `login` / `whoami`; only CLIs that spell them
	// differently set them (neon authenticates with `neon auth`, and supabase
	// has no whoami at all).
	Login     []string
	AuthCheck []string
	// Skill is the .agents/skills directory installed alongside the CLI, when
	// it isn't named after the CLI (the Cloudflare skill covers `wrangler`).
	Skill string
}

func (c connector) skillDir() string {
	if c.Skill != "" {
		return c.Skill
	}
	return c.Name
}

func (c connector) loginArgs() []string {
	if len(c.Login) > 0 {
		return c.Login
	}
	return []string{"login"}
}

func (c connector) authCheckArgs() []string {
	if len(c.AuthCheck) > 0 {
		return c.AuthCheck
	}
	return []string{"whoami"}
}

type Status struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Installed   bool   `json:"installed"`
	// Checked says whether Authenticated means anything: auth is only ever
	// known after a CheckAuth or a Connect, never from opening a screen.
	Checked       bool   `json:"checked"`
	Authenticated bool   `json:"authenticated"`
	Version       string `json:"version"`
}

var supported = []connector{
	{Name: "wrangler", DisplayName: "Cloudflare", Skill: "cloudflare"},
	{Name: "vercel", DisplayName: "Vercel"},
	{Name: "neon", DisplayName: "Neon", Login: []string{"auth"}, AuthCheck: []string{"me"}},
	{Name: "supabase", DisplayName: "Supabase", AuthCheck: []string{"projects", "list"}},
}

// Every call below crosses into WSL on Windows, where a cold or wedged distro
// hangs indefinitely and takes the calling Wails binding — and the screen
// waiting on it — with it. Each gets the smallest deadline its work can live
// with: a status check is seconds, an npm install minutes, a browser login as
// long as a person plausibly takes.
const (
	checkTimeout   = 90 * time.Second
	installTimeout = 10 * time.Minute
	loginTimeout   = 5 * time.Minute
)

type Connectors struct{}

func NewConnectors() *Connectors { return &Connectors{} }

// run executes a CLI that VibeOps installs or queries, wherever shell.Command
// puts it — on Windows that is inside WSL, which is where these npm-installed
// binaries actually live. Combined output so callers can surface stderr on
// failure. Unsandboxed: these need their own config and credential dirs.
func run(ctx context.Context, name string, args ...string) ([]byte, error) {
	cmd, err := shell.Command(ctx, nil, name, args...)
	if err != nil {
		return nil, err
	}
	return cmd.CombinedOutput()
}

// installSkill ships the CLI's skill to ~/.agents/skills so the coding
// harnesses pick it up when run on their own; VibeOps' agent reads the bundled
// copy. Called on every path that ends with a usable CLI — not only Install,
// since a user who already had the CLI never presses Install.
func installSkill(c connector, done string) error {
	if err := skills.Install(c.skillDir()); err != nil {
		return fmt.Errorf("%s %s, but installing its skill failed: %w", c.DisplayName, done, err)
	}
	return nil
}

func find(name string) (connector, error) {
	for _, c := range supported {
		if c.Name == name {
			return c, nil
		}
	}
	return connector{}, fmt.Errorf("unsupported connector: %s", name)
}

// Install puts the CLI on PATH. Authenticating it is a separate step (Connect)
// — installed and connected are independent states, and a CLI can be installed
// by the user long before VibeOps ever sees it.
func (s *Connectors) Install(name string) error {
	c, err := find(name)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), installTimeout)
	defer cancel()
	// ponytail: assumes npm on PATH; surface stderr if it isn't.
	out, err := run(ctx, "npm", "install", "-g", name)
	if err != nil {
		return fmt.Errorf("%s: %w", string(out), err)
	}
	return installSkill(c, "installed")
}

// Connect runs the CLI's own login flow. Requires the CLI to already be
// installed.
func (s *Connectors) Connect(name string) error {
	c, err := find(name)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), loginTimeout)
	defer cancel()
	if !shell.Look(ctx, c.Name) {
		return fmt.Errorf("%s is not installed", c.DisplayName)
	}
	// Login is interactive (opens a browser, waits for the callback), so the
	// deadline is what eventually frees a flow the user abandoned — the CLI
	// itself waits forever.
	// ponytail: no user-facing cancel; give Connect a runID and route it through
	// tools.Cancel if abandoning a login mid-flow turns out to be common.
	// ponytail: on Windows this runs inside WSL, where opening the host browser
	// depends on wslu/interop being set up. Falls back to the printed URL,
	// which is workable but not obvious.
	out, err := run(ctx, c.Name, c.loginArgs()...)
	if err != nil {
		return fmt.Errorf("%s: %w", string(out), err)
	}
	if err := rememberAuth(c.Name, true); err != nil {
		return err
	}
	return installSkill(c, "connected")
}

// Auth results are cached on disk because finding them out is expensive and
// intrusive: `neon me` and `supabase projects list` launch a browser login when
// the CLI isn't signed in, so probing every connector on every visit to the
// settings screen popped browser windows for connectors the user never asked
// to connect. Nothing probes without the user pressing something.
func authCachePath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	return filepath.Join(dir, "VibeOps", "connector-auth.json")
}

func rememberAuth(name string, authenticated bool) error {
	return jsonstore.Edit(authCachePath(), func(m map[string]bool) map[string]bool {
		if m == nil {
			m = map[string]bool{}
		}
		m[name] = authenticated
		return m
	})
}

// CheckAll reports what is installed, and the last known auth result for each
// — cheap and side-effect free, safe to call whenever a screen opens. Use
// CheckAuth to actually ask a CLI whether it is signed in.
func (s *Connectors) CheckAll() ([]Status, error) {
	cached, err := jsonstore.Read[map[string]bool](authCachePath())
	if err != nil {
		// A corrupt cache is not worth failing a screen over; it just means
		// nothing is known yet.
		cached = nil
	}
	statuses := make([]Status, len(supported))
	var wg sync.WaitGroup
	for i, c := range supported {
		wg.Add(1)
		go func(i int, c connector) {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(context.Background(), checkTimeout)
			defer cancel()
			authenticated, checked := cached[c.Name]
			statuses[i] = Status{
				Name:          c.Name,
				DisplayName:   c.DisplayName,
				Installed:     shell.Look(ctx, c.Name),
				Checked:       checked,
				Authenticated: authenticated,
			}
		}(i, c)
	}
	wg.Wait()
	return statuses, nil
}

// CheckAuth asks one CLI whether it is signed in, and caches the answer. This
// is the intrusive half of the old CheckAll: for some connectors the check is
// itself a login flow, so it only ever runs on an explicit user action.
func (s *Connectors) CheckAuth(name string) (Status, error) {
	c, err := find(name)
	if err != nil {
		return Status{}, err
	}
	// The check can be a login flow, so it gets the login deadline, not the
	// status one.
	ctx, cancel := context.WithTimeout(context.Background(), loginTimeout)
	defer cancel()
	status := Status{Name: c.Name, DisplayName: c.DisplayName, Checked: true}
	if status.Installed = shell.Look(ctx, c.Name); !status.Installed {
		return status, nil
	}
	// Exit code, not output matching: each CLI words its whoami differently,
	// but all exit non-zero when unauthenticated.
	_, err = run(ctx, c.Name, c.authCheckArgs()...)
	status.Authenticated = err == nil
	if err := rememberAuth(c.Name, status.Authenticated); err != nil {
		return status, err
	}
	if !status.Authenticated {
		return status, nil
	}
	return status, installSkill(c, "is signed in")
}
