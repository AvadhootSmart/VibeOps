//go:build !darwin

package shell

import "path"

// bwrapArgs builds the bubblewrap invocation that hides sensitiveDirs, for every
// home in homes — on Windows that is both the Linux home and the Windows one,
// since the latter is mounted inside the distro and is just as readable.
//
// --dev-bind / / hands the sandbox the real filesystem; the tmpfs mounts then
// blank out the credential dirs on top of it. An empty tmpfs rather than a
// missing path is deliberate: the directory still exists, so a read fails as
// "empty" rather than tripping tooling that treats ENOENT as "not configured".
//
// --die-with-parent is load-bearing for Cancel. Killing our own child otherwise
// leaves the sandboxed process running, and on Windows our child is the wsl.exe
// relay, not the shell — without this the Linux side would survive with nothing
// left to signal it.
//
// Paths that don't exist are skipped: bubblewrap would otherwise create each
// mount point on the real disk (--dev-bind / /), littering the home with empty
// ~/.npmrc and ~/.docker/config.json files — the second breaks docker. exists
// answers for whichever side of the WSL boundary a home is on.
func bwrapArgs(homes []string, exists func(string) bool) []string {
	args := []string{"--dev-bind", "/", "/", "--die-with-parent"}
	for _, home := range homes {
		for _, dir := range sensitiveDirs {
			if p := path.Join(home, dir); exists(p) {
				args = append(args, "--tmpfs", p)
			}
		}
		for _, file := range sensitiveFiles {
			if p := path.Join(home, file); exists(p) {
				args = append(args, "--ro-bind", "/dev/null", p)
			}
		}
	}
	return args
}
