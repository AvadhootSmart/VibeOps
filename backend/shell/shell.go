// Package shell is the one place VibeOps runs anything on the local machine.
//
// It exists as its own package because both tools and settings need it and
// tools already imports settings — there is no lower place to put it.
//
// Two entry points, deliberately different:
//
//	Cmd     — a script the *model* wrote. Sandboxed away from credential stores,
//	          because that string is untrusted input.
//	Command — a program VibeOps itself chose (claude, npm, wrangler). Not
//	          sandboxed; these need their own config dirs to work.
//
// On Windows both hop into WSL. That is the whole reason the rest of the
// codebase has no OS branches: the shell contract is POSIX everywhere, so the
// $SECRET_ quoting, the tool descriptions and the system prompts stay
// OS-neutral instead of forking three ways.
package shell

import (
	"slices"
	"strings"
)

// sensitiveDirs are the credential stores the model's shell must not be able to
// read. Scanning the script for them would be theater — base64, xxd and python
// all walk around a denylist — so these are hidden by the kernel instead: a
// seatbelt profile on macOS, a tmpfs mount over each one under bubblewrap
// elsewhere.
//
// SSH still works: keys are loaded in-process by backend/tools/ssh.go, never
// through this shell.
//
// The connector CLIs' own tokens (Vercel, Wrangler, Neon, Supabase, Atlas) are
// left readable on purpose: the agent deploys by running those CLIs here, and they
// must read their auth to work. A known limitation, stated in INSTALL.md.
var sensitiveDirs = []string{
	".ssh", ".aws", ".gnupg", ".kube", ".azure",
	".config/gh", ".config/gcloud",
	".mozilla", ".config/google-chrome", ".config/chromium",
}

// Unhide names the sensitiveDirs the user has opted into sharing with the
// model's shell by connecting that cloud's connector (AWS, Azure, Google
// Cloud) — the CLI can't work with its credentials hidden, but a user who never
// connected one keeps them hidden. Set by backend/connectors.
var Unhide func() []string

func hiddenDirs() []string {
	if Unhide == nil {
		return sensitiveDirs
	}
	shared := Unhide()
	var out []string
	for _, d := range sensitiveDirs {
		if !slices.Contains(shared, d) {
			out = append(out, d)
		}
	}
	return out
}

// sensitiveFiles are single credential files. A tmpfs can't mount over a file,
// so under bubblewrap each is shadowed by /dev/null instead.
var sensitiveFiles = []string{
	".git-credentials", ".docker/config.json", ".npmrc", ".pypirc", ".netrc",
	".cargo/credentials.toml",
}

// Quote wraps v in single quotes so a value containing spaces, $ or quotes can
// neither break the surrounding command nor inject into it. Used for secret
// substitution and for every argument we hand to a shell.
func Quote(v string) string {
	return "'" + strings.ReplaceAll(v, "'", `'\''`) + "'"
}

// winToShellPath is the C:\Users\x -> /mnt/c/Users/x rewrite behind the Windows
// ToShellPath. It lives here, untagged, so its test runs on a developer's mac
// rather than only on the one machine where the bug would bite.
// Separators are rewritten explicitly rather than with filepath.ToSlash, which
// is a no-op unless the host is Windows — the one place this runs is the one
// place that would silently do nothing.
func winToShellPath(p string) string {
	slashed := strings.ReplaceAll(p, `\`, "/")
	if len(p) >= 2 && p[1] == ':' {
		return "/mnt/" + strings.ToLower(p[:1]) + slashed[2:]
	}
	return slashed
}

// Status reports whether local commands can run at all. Windows needs WSL and
// bubblewrap installed; Linux needs bubblewrap. The UI shows Message as setup
// instructions, and Cmd refuses to run while Ready is false.
type Status struct {
	Ready   bool   `json:"ready"`
	Message string `json:"message"`
}

// SudoPreamble spends the sudo password before the model's command can read it.
//
// The password arrives on the session's stdin, and the model writes the command
// that stdin is attached to — so a command like `head -1 > /tmp/p; sudo true`
// matches the sudo check, gets the password piped in, and captures it instead of
// passing it to sudo. Feeding an agent-authored shell a secret on stdin and
// trusting it to consume it correctly is not a boundary.
//
// So sudo takes it first, from a line we control, and stdin is then replaced
// with /dev/null. `-v` caches the credential instead of running anything; the
// model's own sudo calls ride that cache. Any later prompt reads EOF and fails
// fast rather than hanging for 120s.
//
// One session, not two: with no TTY, sudo keys its timestamp to the parent pid,
// so a credential cached in a separate exec session would not be seen here.
//
// The trailing exit is load-bearing for the same reason. A shell with nothing
// left to do after the last command exec()s it in its own process instead of
// forking (zsh and bash 5 both do this), which would hand the model's sudo
// sshd as its parent rather than this shell — missing the credential -v just
// cached and failing with sudo's own "a terminal is required". Leaving a
// statement after the command forces the fork, and $? carries the real status.
func SudoPreamble(command string) string {
	return "sudo -S -p '' -v || { echo 'sudo authentication failed' >&2; exit 1; }\n" +
		"exec 0</dev/null\n" +
		command + "\n" +
		"__vibeops_rc=$?\n" +
		"exit $__vibeops_rc"
}
