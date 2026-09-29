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
