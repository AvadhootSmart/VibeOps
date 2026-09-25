//go:build !darwin && !windows

package shell

import (
	"context"
	"errors"
	"os"
	"os/exec"
)

const installBwrap = "bubblewrap is required to sandbox local commands. Install it (apt install bubblewrap / dnf install bubblewrap) and restart VibeOps."

func Check() Status {
	if _, err := exec.LookPath("bwrap"); err != nil {
		return Status{Message: installBwrap}
	}
	return Status{Ready: true}
}

func Cmd(ctx context.Context, script string) (*exec.Cmd, error) {
	if s := Check(); !s.Ready {
		return nil, errors.New(s.Message)
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, errors.New("cannot sandbox the shell: home directory is unknown")
	}
	args := append(bwrapArgs([]string{home}, pathExists), "sh", "-c", script)
	return exec.CommandContext(ctx, "bwrap", args...), nil
}

func pathExists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

func Command(ctx context.Context, env map[string]string, name string, args ...string) (*exec.Cmd, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = os.Environ()
	for k, v := range env {
		cmd.Env = append(cmd.Env, k+"="+v)
	}
	return cmd, nil
}

// ToShellPath is identity here: the shell and the app see the same filesystem.
func ToShellPath(p string) string { return p }

// Hide is a no-op: only Windows conjures a console window per child.
func Hide(cmd *exec.Cmd) *exec.Cmd { return cmd }

// Look reports whether a program is runnable, replacing bare exec.LookPath so
// the answer comes from wherever Command would actually run it.
func Look(ctx context.Context, name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}
