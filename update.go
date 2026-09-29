package main

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Update downloads the latest build and swaps it in place of the running one;
// the new version takes over on Restart. Both platforms stage next to the
// install so the final swap is a same-volume rename, never a half-copied app.
// A translocated run can't be swapped, so it installs to ~/Applications and
// Restart picks that copy up.
func (a *App) Update() error {
	switch goruntime.GOOS {
	case "darwin":
		return updateMac()
	case "windows":
		return updateWindows()
	}
	return errors.New("updates are only supported on macOS and Windows")
}

// relocatedInstall is set when the running bundle sits on Gatekeeper's
// read-only translocation mount; Restart then launches the freshly installed
// copy instead of the throwaway one this process started from.
var relocatedInstall string

// Restart launches the installed build and quits this one. There is no
// single-instance lock, so the two briefly overlapping is harmless.
func (a *App) Restart() error {
	var cmd *exec.Cmd
	if goruntime.GOOS == "darwin" {
		bundle, err := appBundle()
		if err != nil {
			return err
		}
		if relocatedInstall != "" {
			bundle = relocatedInstall
		}
		cmd = exec.Command("open", "-n", bundle)
	} else {
		exe, err := os.Executable()
		if err != nil {
			return err
		}
		cmd = exec.Command(exe)
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	runtime.Quit(a.ctx)
	return nil
}

func download(platform, dest string) error {
	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Get("https://getvibeops.in/downloads/" + platform + "/latest")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed: %s", resp.Status)
	}
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		return err
	}
	return f.Close()
}

func appBundle() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	bundle := filepath.Dir(filepath.Dir(filepath.Dir(exe)))
	if !strings.HasSuffix(bundle, ".app") {
		return "", errors.New("not running from an app bundle")
	}
	return bundle, nil
}

// signingLeaf is the certificate hash the running app is signed with. The
// update has to carry the same one — that, not TLS, is what stops a swapped
// download from being installed. Pinned to the leaf alone rather than the full
// designated requirement because the bundle identifier changed between
// releases, and the certificate is the part that proves it's ours.
func signingLeaf(bundle string) (string, error) {
	out, err := exec.Command("codesign", "-d", "-r-", bundle).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("codesign: %s", strings.TrimSpace(string(out)))
	}
	_, rest, ok := strings.Cut(string(out), `certificate leaf = H"`)
	if !ok {
		return "", errors.New("this build isn't signed with the release certificate, so it can't verify an update")
	}
	leaf, _, _ := strings.Cut(rest, `"`)
	return leaf, nil
}

// installTarget is where the update goes: normally the running bundle itself.
// Gatekeeper puts a quarantined app on a randomized read-only mount (App
// Translocation), which can't be swapped in place — those updates install to
// ~/Applications instead, a stable home the app then runs from, where later
// updates swap normally.
func installTarget(bundle string) (string, error) {
	if !strings.Contains(bundle, "/AppTranslocation/") {
		return bundle, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Applications", "VibeOps.app"), nil
}

func updateMac() error {
	bundle, err := appBundle()
	if err != nil {
		return err
	}
	leaf, err := signingLeaf(bundle)
	if err != nil {
		return err
	}
	target, err := installTarget(bundle)
	if err != nil {
		return err
	}
	if target != bundle {
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		relocatedInstall = target
	}
	stage, err := os.MkdirTemp(filepath.Dir(target), ".vibeops-update-")
	if err != nil {
		return fmt.Errorf("can't write next to %s: %w", target, err)
	}
	defer os.RemoveAll(stage)

	zip := filepath.Join(stage, "update.zip")
	if err := download("macos", zip); err != nil {
		return err
	}
	// ditto, not archive/zip: the seal depends on symlinks and xattrs Go drops.
	if out, err := exec.Command("ditto", "-x", "-k", zip, stage).CombinedOutput(); err != nil {
		return fmt.Errorf("unzip: %s", strings.TrimSpace(string(out)))
	}
	next := filepath.Join(stage, "VibeOps.app")
	requirement := fmt.Sprintf(`-R=certificate leaf = H"%s"`, leaf)
	if out, err := exec.Command("codesign", "--verify", "--deep", "--strict", requirement, next).CombinedOutput(); err != nil {
		return fmt.Errorf("update failed signature check: %s", strings.TrimSpace(string(out)))
	}

	old := filepath.Join(stage, "old.app")
	if _, statErr := os.Stat(target); statErr == nil {
		if err := os.Rename(target, old); err != nil {
			return err
		}
	} else if !errors.Is(statErr, os.ErrNotExist) {
		return statErr
	}
	if err := os.Rename(next, target); err != nil {
		os.Rename(old, target)
		return err
	}
	return nil
}

// Windows refuses to overwrite a running exe but allows renaming it, so the
// old one steps aside as .old and is deleted on the next launch.
func updateWindows() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	next := exe + ".new"
	defer os.Remove(next)
	if err := download("windows", next); err != nil {
		return err
	}
	old := exe + ".old"
	os.Remove(old)
	if err := os.Rename(exe, old); err != nil {
		return fmt.Errorf("can't replace %s: %w", exe, err)
	}
	if err := os.Rename(next, exe); err != nil {
		os.Rename(old, exe)
		return err
	}
	return nil
}

func removeReplacedExe() {
	if exe, err := os.Executable(); err == nil {
		os.Remove(exe + ".old")
	}
}
