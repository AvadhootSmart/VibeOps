// Package connectors drives the deploy-target CLIs VibeOps can install and
// authenticate on the user's behalf (wrangler, vercel, neon, supabase, and the
// az, aws, gcloud and atlas cloud CLIs). It is
// split from backend/settings because none of this is configuration: it shells
// out, installs npm packages, and runs interactive login flows. Settings only
// ever reads and writes local state.
//
// The agent-harness CLIs (claude, cursor-agent, opencode) are NOT here: VibeOps
// neither installs nor logs those in, and detecting them belongs next to the
// code that runs them — see tools.Harness.Check.
package connectors

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	goruntime "runtime"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

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
	// Answers, when set, is fed to the login's stdin — for a CLI that asks a
	// question VibeOps knows the answer to.
	Answers string
	// Flags returns extra flags for both login and the sign-in check.
	Flags func(ctx context.Context) []string
	// Skill is the .agents/skills directory installed alongside the CLI.
	// Prefixed vibeops- so an agent picks ours over a same-named skill the
	// user installed elsewhere, and knows it describes VibeOps' setup.
	Skill string
	// Brew is set for the CLIs that aren't npm packages. Homebrew installs them
	// on macOS; elsewhere the official installers need sudo, which VibeOps has no
	// terminal to ask for, so Install hands the user ManualInstall instead.
	Brew          []string
	ManualInstall string
	// ManualLogin replaces a failed Connect's error on Windows, for a CLI whose
	// login can fall back to a flow that needs typed input VibeOps can't give.
	ManualLogin string
	// Credentials is the home-relative dir the CLI keeps its sign-in in, when
	// the model's shell hides it (backend/shell sensitiveDirs). Connecting is
	// the user's consent to share it; until then it stays hidden.
	Credentials string
	// NoKeychain runs the CLI with /usr/bin/security blocked on macOS. For a
	// CLI that would otherwise keep its tokens in the Keychain, which the
	// model's shell can't reach: denied the tool outright, it falls back to its
	// config file, which both sides can read.
	NoKeychain bool
}

func (c connector) loginArgs() []string {
	if len(c.Login) > 0 {
		return c.Login
	}
	return []string{"login"}
}

func (c connector) flags(ctx context.Context) []string {
	if c.Flags == nil {
		return nil
	}
	return c.Flags(ctx)
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
	// InstallCommand is set when VibeOps can't install the CLI itself on this
	// platform: the command for the user to run instead.
	InstallCommand string `json:"installCommand"`
	// SharesCredentials is the credential dir connecting makes readable to the
	// model's shell, e.g. "~/.aws".
	SharesCredentials string `json:"sharesCredentials"`
}

func newStatus(c connector) Status {
	s := Status{Name: c.Name, DisplayName: c.DisplayName}
	if _, err := c.installCommand(); err != nil {
		s.InstallCommand = c.ManualInstall
	}
	if c.Credentials != "" {
		s.SharesCredentials = "~/" + c.Credentials
	}
	return s
}

var supported = []connector{
	{Name: "wrangler", DisplayName: "Cloudflare", Skill: "vibeops-cloudflare"},
	{Name: "vercel", DisplayName: "Vercel", Skill: "vibeops-vercel"},
	{Name: "neon", DisplayName: "Neon", Skill: "vibeops-neon", Login: []string{"auth"}, AuthCheck: []string{"me"}},
	{Name: "supabase", DisplayName: "Supabase", Skill: "vibeops-supabase", AuthCheck: []string{"projects", "list"}},
	{
		Name: "az", DisplayName: "Azure", Skill: "vibeops-azure",
		// Not `account show`: it only reads azureProfile.json, so an expired
		// session still passes it. This refreshes, and prints only the expiry.
		AuthCheck:     []string{"account", "get-access-token", "--query", "expiresOn", "-o", "tsv"},
		Brew:          []string{"azure-cli"},
		ManualInstall: "curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash",
		Credentials:   ".azure",
	},
	{
		// `aws login` (CLI 2.32+) is the browser console sign-in; SSO and access
		// key setups are covered by the skill.
		// Answers "y" to "Profile default is already configured to use session
		// X. Do you want to overwrite it?" — pressing Connect means yes.
		Name: "aws", DisplayName: "AWS", Skill: "vibeops-aws",
		AuthCheck:     []string{"sts", "get-caller-identity"},
		Answers:       "y\n",
		Flags:         awsRegionIfUnset,
		Brew:          []string{"awscli"},
		ManualInstall: `sudo apt-get install -y unzip && curl -fsSLo /tmp/awscliv2.zip "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" && unzip -qo /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install --update`,
		Credentials:   ".aws",
	},
	{
		Name: "gcloud", DisplayName: "Google Cloud", Skill: "vibeops-gcp",
		Login: []string{"auth", "login"},
		// Forces a token refresh, so a revoked sign-in fails; prints only the
		// expiry, where print-access-token would put a token on screen.
		AuthCheck:     []string{"config", "config-helper", "--force-auth-refresh", "--format=value(credential.token_expiry)", "--quiet"},
		Brew:          []string{"--cask", "gcloud-cli"},
		ManualInstall: `sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates gnupg curl && curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor --yes -o /usr/share/keyrings/cloud.google.gpg && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee /etc/apt/sources.list.d/google-cloud-sdk.list && sudo apt-get update && sudo apt-get install -y google-cloud-cli`,
		// Without a browser WSL can open (no WSLg on Windows 10), gcloud falls
		// back to pasting a code into the terminal.
		ManualLogin: "Google Cloud couldn't finish signing in from VibeOps. Run `gcloud auth login` in your WSL terminal, then press Check sign-in.",
		Credentials: ".config/gcloud",
	},
	{
		// --force skips the auth-type picker and the "press Enter" before the
		// browser, --skipConfig the org/project picker: all survey prompts that
		// fail without a terminal.
		Name: "atlas", DisplayName: "MongoDB Atlas", Skill: "vibeops-mongodb-atlas",
		Login: []string{"auth", "login", "--force", "--skipConfig"},
		// Not `auth whoami`: it only reads the local config, so an expired
		// session still passes it.
		AuthCheck:     []string{"projects", "list"},
		Brew:          []string{"mongodb-atlas-cli"},
		ManualInstall: `curl -fsSL https://pgp.mongodb.com/server-8.0.asc | sudo gpg --dearmor --yes -o /usr/share/keyrings/mongodb-server-8.0.gpg && echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.com/apt/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME)/mongodb-enterprise/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-enterprise-8.0.list && sudo apt-get update && sudo apt-get install -y mongodb-atlas-cli`,
		NoKeychain:    true,
	},
}

func init() {
	shell.Unhide = sharedCredentials
}

// awsRegionIfUnset: with no region configured, `aws login` asks for one in a
// terminal prompt, which fails without a terminal before the browser opens.
// --region skips it, and unlike answering the prompt writes nothing to
// ~/.aws/config — the skill has the agent pass --region itself.
func awsRegionIfUnset(ctx context.Context) []string {
	out, err := run(ctx, nil, "", "aws", "configure", "get", "region")
	if err == nil && strings.TrimSpace(string(out)) != "" {
		return nil
	}
	return []string{"--region", "us-east-1"}
}

// sharedCredentials is read on every sandboxed command rather than cached, so
// a connector whose sign-in check fails is hidden again from the next command.
func sharedCredentials() []string {
	cached, _ := jsonstore.Read[map[string]bool](authCachePath())
	var dirs []string
	for _, c := range supported {
		if c.Credentials != "" && cached[c.Name] {
			dirs = append(dirs, c.Credentials)
		}
	}
	return dirs
}

func (c connector) installCommand() ([]string, error) {
	if len(c.Brew) == 0 {
		// ponytail: assumes npm on PATH; surface stderr if it isn't.
		return []string{"npm", "install", "-g", c.Name}, nil
	}
	if goruntime.GOOS == "darwin" {
		// ponytail: assumes Homebrew; surface stderr if it isn't there.
		return append([]string{"brew", "install"}, c.Brew...), nil
	}
	return nil, fmt.Errorf("install %s from your WSL terminal: %s", c.DisplayName, c.ManualInstall)
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

// eventCtx is the Wails runtime context output is streamed on; set once at
// startup. ponytail: package-level, fine for a single window.
var eventCtx context.Context

func SetEventCtx(ctx context.Context) { eventCtx = ctx }

// noKeychain is the macOS sandbox profile for NoKeychain connectors.
const noKeychain = `(version 1)(allow default)(deny process-exec (literal "/usr/bin/security"))`

// ansi matches colour and cursor escapes, which the Settings row would show
// as garbage.
var ansi = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]`)

// run executes a CLI that VibeOps installs or queries, wherever shell.Command
// puts it — on Windows that is inside WSL, which is where these npm-installed
// binaries actually live. Combined output so callers can surface stderr on
// failure. Unsandboxed: these need their own config and credential dirs.
//
// With c set, each line is also streamed to c's row in Settings as
// `connector:output` while the CLI runs: a login can print a code to type into
// the browser (Atlas) or a URL it failed to open (anything in WSL), and the
// user has to see those before the command ends, not after.
func run(ctx context.Context, c *connector, stdin string, name string, args ...string) ([]byte, error) {
	var env map[string]string
	if c != nil && goruntime.GOOS == "windows" {
		// Python's webbrowser (az, aws, gcloud) and xdg-open find nothing to
		// open inside a stock WSL distro; explorer.exe hands the URL to the
		// Windows default browser. A single word, because webbrowser treats a
		// $BROWSER with spaces as one program name.
		env = map[string]string{"BROWSER": "explorer.exe"}
	}
	if c != nil && c.NoKeychain && name == c.Name && goruntime.GOOS == "darwin" {
		name, args = "sandbox-exec", append([]string{"-p", noKeychain, name}, args...)
	}
	cmd, err := shell.Command(ctx, env, name, args...)
	if err != nil {
		return nil, err
	}
	switch {
	case stdin == "":
	case cmd.Stdin == nil:
		cmd.Stdin = strings.NewReader(stdin)
	default:
		// On Windows cmd.Stdin already carries the script `bash -s` runs inside
		// WSL. bash reads a pipe a byte at a time, so whatever follows the
		// script is left for the CLI it execs.
		cmd.Stdin = io.MultiReader(cmd.Stdin, strings.NewReader("\n"+stdin))
	}

	pr, pw := io.Pipe()
	cmd.Stdout, cmd.Stderr = pw, pw
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	done := make(chan error, 1)
	go func() {
		err := cmd.Wait()
		pw.Close()
		done <- err
	}()
	var out bytes.Buffer
	scanner := bufio.NewScanner(pr)
	for scanner.Scan() {
		line := ansi.ReplaceAllString(scanner.Text(), "")
		// Progress bars redraw with \r; only the last frame is the line.
		if i := strings.LastIndexByte(line, '\r'); i >= 0 {
			line = line[i+1:]
		}
		out.WriteString(line + "\n")
		if c != nil && eventCtx != nil && strings.TrimSpace(line) != "" {
			runtime.EventsEmit(eventCtx, "connector:output", c.Name, line)
		}
	}
	// A line past the scanner's limit stops it; keep draining so the CLI
	// never blocks writing to a pipe nobody reads.
	io.Copy(io.Discard, pr)
	return out.Bytes(), <-done
}

// installSkill ships the CLI's skill to ~/.agents/skills so the coding
// harnesses pick it up when run on their own; VibeOps' agent reads the bundled
// copy. Called on every path that ends with a usable CLI — not only Install,
// since a user who already had the CLI never presses Install.
func installSkill(c connector, done string) error {
	if err := skills.Install(c.Skill); err != nil {
		return fmt.Errorf("%s %s, but installing its skill failed: %w", c.DisplayName, done, err)
	}
	// Best effort: a stale duplicate is untidy, not a failed connect.
	skills.RemoveLegacy(strings.TrimPrefix(c.Skill, "vibeops-"), c.Skill)
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
	command, err := c.installCommand()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), installTimeout)
	defer cancel()
	out, err := run(ctx, &c, "", command[0], command[1:]...)
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
	out, err := run(ctx, &c, c.Answers, c.Name, append(c.loginArgs(), c.flags(ctx)...)...)
	if err != nil {
		if goruntime.GOOS == "windows" && c.ManualLogin != "" {
			return fmt.Errorf("%s\n\n%s", c.ManualLogin, out)
		}
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
			status := newStatus(c)
			status.Authenticated, status.Checked = cached[c.Name]
			status.Installed = shell.Look(ctx, c.Name)
			statuses[i] = status
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
	status := newStatus(c)
	status.Checked = true
	if status.Installed = shell.Look(ctx, c.Name); !status.Installed {
		return status, nil
	}
	// Exit code, not output matching: each CLI words its whoami differently,
	// but all exit non-zero when unauthenticated.
	_, err = run(ctx, &c, "", c.Name, append(c.authCheckArgs(), c.flags(ctx)...)...)
	status.Authenticated = err == nil
	if err := rememberAuth(c.Name, status.Authenticated); err != nil {
		return status, err
	}
	if !status.Authenticated {
		return status, nil
	}
	return status, installSkill(c, "is signed in")
}
