package connectors

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"VibeOps/backend/skills"
)

// The whole point of the split: opening a screen reads the cache, it never
// asks a CLI — for neon and supabase, asking is a browser login flow.
func TestCheckAllReportsCachedAuthOnly(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	s := NewConnectors()

	cold, err := s.CheckAll()
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range cold {
		if c.Checked {
			t.Fatalf("%s reported a sign-in result nobody asked for", c.Name)
		}
	}

	if err := rememberAuth("vercel", true); err != nil {
		t.Fatal(err)
	}
	warm, err := s.CheckAll()
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range warm {
		want := c.Name == "vercel"
		if c.Checked != want || c.Authenticated != want {
			t.Fatalf("%s: checked=%v authenticated=%v, want %v", c.Name, c.Checked, c.Authenticated, want)
		}
	}
}

// A CLI the user installed themselves never goes through Install, so a sign-in
// check that finds it authenticated is what ships its skill.
func TestCheckAuthInstallsSkillWhenSignedIn(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the fake CLI is a shell script, and Windows runs it inside WSL")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	skills.Packaged = os.DirFS("../../.agents/skills")

	bin := t.TempDir()
	if err := os.WriteFile(filepath.Join(bin, "wrangler"), []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))

	status, err := NewConnectors().CheckAuth("wrangler")
	if err != nil || !status.Authenticated {
		t.Fatalf("status=%+v err=%v", status, err)
	}
	if _, err := os.Stat(filepath.Join(home, ".agents", "skills", "vibeops-cloudflare", "SKILL.md")); err != nil {
		t.Fatalf("skill not installed: %v", err)
	}
}

// A cloud's credential dir reaches the model's shell only once the user has
// connected that cloud, and is hidden again when a sign-in check fails.
func TestCredentialsSharedOnlyWhenConnected(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	if got := sharedCredentials(); len(got) != 0 {
		t.Fatalf("nothing connected, shared %v", got)
	}
	if err := rememberAuth("aws", true); err != nil {
		t.Fatal(err)
	}
	if err := rememberAuth("az", false); err != nil {
		t.Fatal(err)
	}
	if got := sharedCredentials(); len(got) != 1 || got[0] != ".aws" {
		t.Fatalf("shared %v, want [.aws]", got)
	}
	if err := rememberAuth("aws", false); err != nil {
		t.Fatal(err)
	}
	if got := sharedCredentials(); len(got) != 0 {
		t.Fatalf("signed out, still shared %v", got)
	}
}

// `aws login` prompts for a region when none is configured and asks before
// replacing an existing session; with no terminal, either prompt fails the
// login. Connect must pass --region and answer the overwrite question.
func TestConnectAWSAnswersItsPrompts(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the fake CLI is a shell script, and Windows runs it inside WSL")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	skills.Packaged = os.DirFS("../../.agents/skills")

	bin := t.TempDir()
	fake := `#!/bin/sh
[ "$1" = configure ] && exit 1
[ "$1 $2 $3" = "login --region us-east-1" ] || { echo "args: $*"; exit 2; }
read answer; [ "$answer" = y ] || { echo "answer: $answer"; exit 3; }
`
	if err := os.WriteFile(filepath.Join(bin, "aws"), []byte(fake), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))

	if err := NewConnectors().Connect("aws"); err != nil {
		t.Fatal(err)
	}
	if got := sharedCredentials(); len(got) != 1 || got[0] != ".aws" {
		t.Fatalf("shared %v after connecting, want [.aws]", got)
	}
}

// Atlas keeps its tokens in the Keychain unless /usr/bin/security can't run at
// all, and the model's shell can't reach the Keychain — so every atlas VibeOps
// runs must have the tool blocked, or the agent's atlas never sees the login.
func TestAtlasRunsWithoutKeychain(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("the Keychain block is macOS-only")
	}
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	skills.Packaged = os.DirFS("../../.agents/skills")

	bin := t.TempDir()
	// Signed in only if the Keychain tool is blocked.
	fake := "#!/bin/sh\n/usr/bin/security list-keychains >/dev/null 2>&1 && exit 1\nexit 0\n"
	if err := os.WriteFile(filepath.Join(bin, "atlas"), []byte(fake), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))

	status, err := NewConnectors().CheckAuth("atlas")
	if err != nil || !status.Authenticated {
		t.Fatalf("atlas ran with the Keychain reachable: status=%+v err=%v", status, err)
	}
}

func TestRunStripsTerminalNoise(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("printf runs inside WSL on Windows")
	}
	out, err := run(context.Background(), nil, "", "printf", `\033[1mcode:\033[0m ABCD-1234\n50%%\r100%%\n`)
	if err != nil {
		t.Fatal(err)
	}
	if got := string(out); got != "code: ABCD-1234\n100%\n" {
		t.Fatalf("out = %q", got)
	}
}
