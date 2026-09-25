// Package settings holds app configuration exposed to the frontend as Wails
// bindings. Unlike the tools package, nothing here is an AI tool — this is
// privileged local config (secrets, preferences) the webview cannot reach on
// its own. Secrets are stored in the OS keychain via go-keyring.
package settings

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"

	"github.com/zalando/go-keyring"

	"VibeOps/backend/jsonstore"
	"VibeOps/backend/shell"
)

const (
	service         = "VibeOps"
	openRouterKeyID = "openrouter-api-key"
	runSecretsID    = "run-secrets"
)

// Server is one machine the user has authorized VibeOps to manage over SSH.
type Server struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IpAddress string `json:"ipAddress"`
	Port      string `json:"port"`
	User      string `json:"user"`
	KeyPath   string `json:"keyPath"`
}

// Config is the whole of config.json. It crosses to the frontend in one piece:
// a getter and a setter per field was a dozen bindings and a Wails regenerate
// for every new preference, and the Assistant paid for three round-trips per
// turn to read three of them. Defaults live in the frontend (lib/config.ts),
// which is the only thing that interprets these.
type Config struct {
	Model string `json:"model"`
	// AgentModels is the --model each harness CLI is run with, keyed by provider
	// id ("claude-code", "cursor", "opencode"). One map rather than a field per
	// CLI, so adding Codex is a row in the UI and nothing here.
	AgentModels   map[string]string `json:"agentModels"`
	Provider      string            `json:"provider"` // "openrouter" (default) | a harness id
	Servers       []Server          `json:"servers"`
	HideToolCalls bool              `json:"hideToolCalls"`
	// ExperimentalAck lists the Experimental providers whose warning the user
	// has accepted, so it is shown once per provider.
	ExperimentalAck []string `json:"experimentalAck"`
}

type Settings struct{}

func NewSettings() *Settings { return &Settings{} }

func configPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	return filepath.Join(dir, service, "config.json")
}

// Run-scoped secret store: the sudo password, plus any env var, API token or DB
// connection string the agent needs but must never see (deploy secrets). These
// are package functions, NOT Settings methods, deliberately: methods on the
// bound Settings struct become webview-callable Wails bindings, and secret
// values must be unreadable from the webview. The app writes them (via
// Harness.ResolveSecret) and the `vibeops mcp` child reads them — both in
// Go. See docs/secret-request-flow.md.
//
// Values are stored one keychain item each, with a single index item holding
// just their names. The obvious design — everything in ONE item as a JSON map —
// is what this replaced: Windows Credential Manager caps a credential blob at
// ~2560 bytes, so two long connection strings overflowed it, and keyring.Set's
// error was swallowed by a store that reports a missing secret as "". macOS has
// no such cap, so it failed only in the place nobody was testing.
//
// The index is written BEFORE the value it names, never after. That order keeps
// ClearSecrets complete across a crash: a name with no value clears harmlessly,
// whereas a value with no name would be a secret nothing could ever delete.

// SudoSecret is the reserved name the sudo password is held under.
const SudoSecret = "sudo"

// secretName is what a secret may be called — it has to survive being written
// as a $SECRET_<NAME> placeholder in a shell command.
var secretName = regexp.MustCompile(`^[A-Za-z0-9_]+$`)

func ValidSecretName(name string) bool { return secretName.MatchString(name) }

var secretsMu sync.Mutex

// secretItem is where one secret's value lives. Names are already constrained to
// [A-Za-z0-9_] by ValidSecretName, so they can't collide with the index item.
func secretItem(name string) string { return runSecretsID + ":" + name }

func secretNames() []string {
	blob, err := keyring.Get(service, runSecretsID)
	if err != nil {
		return nil
	}
	var names []string
	json.Unmarshal([]byte(blob), &names)
	return names
}

func readSecrets() map[string]string {
	m := map[string]string{}
	for _, name := range secretNames() {
		if v, err := keyring.Get(service, secretItem(name)); err == nil {
			m[name] = v
		}
	}
	return m
}

func SetSecret(name, value string) error {
	secretsMu.Lock()
	defer secretsMu.Unlock()
	names := secretNames()
	if !slices.Contains(names, name) {
		b, err := json.Marshal(append(names, name))
		if err != nil {
			return err
		}
		if err := keyring.Set(service, runSecretsID, string(b)); err != nil {
			return err
		}
	}
	return keyring.Set(service, secretItem(name), value)
}

// GetSecret returns the held value, or "" if that name was never answered.
func GetSecret(name string) string {
	v, err := keyring.Get(service, secretItem(name))
	if err != nil {
		return ""
	}
	return v
}

func ClearSecrets() error {
	secretsMu.Lock()
	defer secretsMu.Unlock()
	// Values first, then the index — dropping the index first would strand every
	// value it names with no record that they exist.
	for _, name := range secretNames() {
		keyring.Delete(service, secretItem(name))
	}
	err := keyring.Delete(service, runSecretsID)
	if errors.Is(err, keyring.ErrNotFound) {
		return nil
	}
	return err
}

// secretRef matches the $SECRET_NAME placeholders the model writes into
// commands in place of values it is not allowed to know.
var secretRef = regexp.MustCompile(`\$SECRET_([A-Za-z0-9_]+)`)

// InjectSecrets swaps $SECRET_NAME for the held value just before the command
// executes. The value is single-quoted for the shell, so one containing spaces,
// $ or quotes can neither break the command nor inject into it — which is also
// why the model is told never to quote the placeholder itself.
//
// A name with no held value fails the command instead of being passed through.
// Passing it through is not safe: secrets live only for the run that requested
// them, so a placeholder written in a later turn reaches the shell as an unset
// variable and expands to the empty string, silently and with exit 0 — turning
// `wrangler secret put X --text $SECRET_X` into a command that overwrites X
// with "" and reports success.
func InjectSecrets(cmd string) (string, error) { return injectChecked(cmd, readSecrets()) }

func injectChecked(cmd string, m map[string]string) (string, error) {
	for _, ref := range secretRef.FindAllStringSubmatch(cmd, -1) {
		if _, ok := m[ref[1]]; !ok {
			return "", fmt.Errorf("command not run: no value is held for $SECRET_%s, so it would have reached the shell as an empty string. Secrets last only for the run that requested them — call secretRequest for %s again, then re-run this command", ref[1], ref[1])
		}
	}
	return injectInto(cmd, m), nil
}

func injectInto(cmd string, m map[string]string) string {
	return secretRef.ReplaceAllStringFunc(cmd, func(ref string) string {
		v, ok := m[secretRef.FindStringSubmatch(ref)[1]]
		if !ok {
			return ref
		}
		return shell.Quote(v)
	})
}

// Redact removes held secret values from command output before it goes back to
// the model. Injection alone is only half the boundary: a deploy that echoes a
// connection string, or a stray `cat .env`, would otherwise write the value
// straight into the transcript.
// ponytail: plain substring scan; values under 4 chars are skipped so a short
// one can't shred unrelated output. Swap for a proper scanner if that bites.
func Redact(out string) string { return redactWith(out, readSecrets()) }

func redactWith(out string, m map[string]string) string {
	for name, v := range m {
		if len(v) >= 4 {
			out = strings.ReplaceAll(out, v, "$SECRET_"+name)
		}
	}
	return out
}

// SecretRequestPath is the file a `vibeops mcp` child writes to ask the running
// app to prompt for a secret. App and child resolve the same path because they
// are the same binary. See docs/secret-request-flow.md.
func SecretRequestPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	return filepath.Join(dir, service, "secret-request.json")
}

func (s *Settings) SetAPIKey(key string) error {
	return keyring.Set(service, openRouterKeyID, key)
}

func (s *Settings) GetAPIKey() (string, error) {
	key, err := keyring.Get(service, openRouterKeyID)
	if errors.Is(err, keyring.ErrNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return key, nil
}

func (s *Settings) HasAPIKey() (bool, error) {
	key, err := s.GetAPIKey()
	if err != nil {
		return false, err
	}
	return key != "", nil
}

func (s *Settings) DeleteAPIKey() error {
	err := keyring.Delete(service, openRouterKeyID)
	if errors.Is(err, keyring.ErrNotFound) {
		return nil
	}
	return err
}

// Get returns the whole config. A missing file yields the zero value, which
// the frontend reads as "nothing set yet".
func (s *Settings) Get() (Config, error) {
	return jsonstore.Read[Config](configPath())
}

// Set replaces the config wholesale. The frontend always writes back what it
// read, so a partial write can't drop a field it doesn't know about.
func (s *Settings) Set(c Config) error {
	return jsonstore.Write(configPath(), c)
}

// Non-nil even when empty — see Skills.List: nil marshals to `null` and the
// callers treat the result as an array.
func (s *Settings) GetAllowedServers() ([]Server, error) {
	c, err := jsonstore.Read[Config](configPath())
	if c.Servers == nil {
		return []Server{}, err
	}
	return c.Servers, err
}

func (s *Settings) AllowServer(server Server) error {
	return jsonstore.Edit(configPath(), func(c Config) Config {
		c.Servers = append(c.Servers, server)
		return c
	})
}

func (s *Settings) RemoveServer(id string) error {
	return jsonstore.Edit(configPath(), func(c Config) Config {
		for i, s := range c.Servers {
			if s.ID == id {
				c.Servers = append(c.Servers[:i], c.Servers[i+1:]...)
				break
			}
		}
		return c
	})
}
