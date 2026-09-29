# Installing VibeOps

## macOS

Download the zip from [getvibeops.in](https://getvibeops.in), unzip it and move
`VibeOps.app` to `/Applications`. Apple Silicon (M1 or later) only; Intel Macs
aren't supported.

The app is self-signed, not notarized, so macOS blocks the first launch. On
macOS 15 and later, open it once, then go to **System Settings → Privacy &
Security** and choose **Open Anyway**; right-click → Open no longer bypasses
the check. Or clear the download flag yourself:

```bash
xattr -dr com.apple.quarantine /Applications/VibeOps.app
```

### From source

After `wails build` (see [CONTRIBUTING.md](CONTRIBUTING.md)) the bundle is in
`build/bin/VibeOps.app`. `./scripts/build.sh` also signs it with a local
certificate it creates on first run, so macOS keeps the permissions you grant
across rebuilds. To install it:

```bash
app="build/bin/VibeOps.app"
dest="/Applications/$(basename "$app")"

# ditto (not cp) preserves the extended attributes / resource forks the code
# signature is sealed over — cp -r can produce a bundle Gatekeeper rejects.
rm -rf "$dest"
ditto "$app" "$dest"

# Re-register with LaunchServices so Spotlight/Launchpad see the new bundle.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$dest"
```

## Windows (experimental)

Unzip `vibeops_windows_v<version>.zip` anywhere and run `VibeOps.exe`. The build
is unsigned, so SmartScreen blocks the first launch — choose **More info → Run
anyway**.

### Prerequisites

VibeOps runs the agent's shell commands inside WSL, so the same POSIX commands
work on every platform. Two things have to be installed first; the app shows a
setup card naming whichever is missing, and refuses to run local commands until
both are present.

1. **WSL.** In an admin PowerShell:

   ```powershell
   wsl --install
   ```

   Reboot, then finish the distro's first-run user setup.

2. **bubblewrap**, inside the distro:

   ```bash
   sudo apt install bubblewrap
   ```

   This is what keeps the agent's shell out of your credential stores — the
   equivalent of the seatbelt sandbox on macOS. VibeOps will not run local
   commands unsandboxed, so this is required, not optional.

Install `claude` **inside WSL** too if you use the Claude Code provider — the
Windows-side CLI is not on the path the agent's shell sees.

### Where things live

The GUI, your saved secrets (Windows Credential Manager) and the SSH client stay
on the Windows side. Everything the agent runs happens inside the distro, where
`C:\Users\you` appears as `/mnt/c/Users/you`. Workspaces are cloned to
`C:\Users\you\VibeOps\workspaces` so Explorer can reach them; git and npm on
`/mnt/c` are noticeably slower than on the Linux filesystem.

SSH keys are read from the **Windows** home (`%USERPROFILE%\.ssh`). If yours live
inside WSL, copy them across or point the key picker at
`\\wsl$\<distro>\home\<user>\.ssh`.

## Linux

Not supported.

## Known limitations

- **Unsigned builds.** No Apple Developer ID or Windows code-signing
  certificate yet, hence the first-launch steps above.
- **Connector CLI tokens are readable inside the sandbox.** The agent deploys by
  running the Vercel, Wrangler, Neon, Supabase and Atlas CLIs, and they must read
  their own auth to work. `~/.aws`, `~/.azure` and `~/.config/gcloud` stay
  hidden until you connect AWS, Azure or Google Cloud in Settings → Connectors.
  On macOS VibeOps keeps the Atlas CLI's login in its config file rather than
  the Keychain, so the assistant's sandbox can read it. Other credential
  stores are hidden.
- **Only `$SECRET_` values are redacted.** The model is told not to read project
  `.env` files, but any other file contents an approved command prints do reach
  the model.
- **Local commands have no timeout.** The stop button cancels them; SSH
  commands time out after 120 seconds.
- **Cursor's own tools are only denied by config** that hasn't been verified,
  which is why it is marked Experimental and asks for acknowledgement.
