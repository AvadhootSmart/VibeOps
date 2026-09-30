# Changelog

Notable changes to VibeOps. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions track `productVersion` in `wails.json`.

VibeOps is **alpha** — the tool bridge, connector list and settings shape are all still moving. Expect breaking changes between minor versions.

## [Unreleased]

## [0.9.4] — 2026-09-30

### Added

- **`listConnectors` tool.** The agent can see which connectors VibeOps supports and which are installed and signed in. When proposing providers it still picks the best fit, and flags one you haven't connected as a setup step.
- **Check for updates** from the refresh button beside the version in the sidebar; it used to check only at launch.

### Changed

- Connector rows no longer show the "Connecting shares ~/…" line, which pushed the button onto its own row.

## [0.9.3] — 2026-09-30

### Changed

- **Windows: the app draws its own title bar.** The native frame is gone; minimise, maximise and close sit at the top right of the app's own title strip, as the traffic lights do on macOS.
- **Windows: Install runs the cloud CLI installers in WSL.** Azure, AWS, Google Cloud and Atlas no longer show "Copy install command". If sudo needs a password, the sudo dialog asks for it, and the installer gets it through `sudo -S`.

## [0.9.0] — 2026-09-29

### Added

- **AWS, Azure, Google Cloud and MongoDB Atlas connectors** (`aws`, `az`, `gcloud`, `atlas`), each with a skill. Install uses Homebrew on macOS; on Windows, Install shows the official command to run in WSL, since those installers need sudo. AWS sign-in passes `--region us-east-1` when no region is configured and answers the "overwrite existing session?" prompt, both of which otherwise fail without a terminal; Atlas signs in with `--force --skipConfig` and is checked with `atlas projects list`, since `auth whoami` never goes online. `~/.aws`, `~/.azure` and `~/.config/gcloud` stay hidden from the model's shell until that cloud is connected, and are hidden again if its sign-in check fails.
- **Live sign-in output.** A connector's install, sign-in and check print into its Settings row as they run, with links clickable — Atlas's one-time code, or a URL a CLI couldn't open from WSL, used to be swallowed until the command ended. On Windows, Install for the cloud CLIs becomes "Copy install command" (their installers need sudo inside WSL), and connector sign-ins get `BROWSER=explorer.exe` so Python-based CLIs open the Windows browser.
- Each cloud row says which credential folder connecting shares with the assistant's shell.

### Changed

- **Connector skills are prefixed `vibeops-`** (`vibeops-cloudflare`, `vibeops-vercel`, `vibeops-neon`, `vibeops-supabase`, `vibeops-aws`, `vibeops-azure`, `vibeops-gcp`, `vibeops-mongodb-atlas`), so an agent picks VibeOps' skill over a same-named one the user installed elsewhere. Connecting removes the unprefixed copy an earlier VibeOps put in `~/.agents/skills` — only when its description matches ours, so a user's own skill of that name is kept.
- Only the `vibeops-` skills ship in the app and appear in the agent's skill list. `ai-elements`, a skill for developing VibeOps' own chat UI, was being embedded and offered to every user's agent.

### Fixed

- Atlas on macOS: VibeOps runs `atlas` with `/usr/bin/security` blocked, so its login lands in the config file the assistant's sandbox can read instead of the Keychain it can't. The model's shell now blocks `/usr/bin/security` outright, not only its Keychain lookups.
- Sign-in checks that only read local files: Azure is checked with `az account get-access-token`, Google Cloud with a forced token refresh, so an expired session no longer shows as Connected.

## [0.7.2] — 2026-09-28

### Added

- **error.log.** Errors from providers, connectors, the updater, failed agent turns and failed tool calls are appended to `error.log` in the app's config folder (`~/Library/Application Support/VibeOps` on macOS, `%AppData%\VibeOps` on Windows), stamped with the time, version and platform. Run secrets and the OpenRouter key are redacted before writing, and the log rolls over at 1 MB. Settings → Troubleshooting → Show in folder reveals it.
- A failed update or restart now shows the underlying error in a toast.

## [0.7.1] — 2026-09-28

### Added

- The Claude Code provider lists every model the `claude` CLI accepts: Fable 5.1 and 5, Opus 5.5, and the Opus/Sonnet 4.x line alongside Opus 5, Sonnet 5, Opus 4.8 and Haiku 4.5.

## [0.7.0] — 2026-09-28

### Added

- **In-app updates.** Clicking the sidebar's update chip downloads the latest build, installs it in place and offers "Restart to apply update". On macOS the download must be signed with the same certificate as the running app; on Windows the replaced exe is removed on the next launch. Works from 0.7.0 on — 0.6.0 still links to the website.
- **Overview hosts and lasting facts.** A row per SSH server (OS, boot time, disk), start or last-deploy time per app and TLS expiry per domain, all stored as absolute times. Uptime strings and placeholder CPU/memory are gone. Deploy is in the sidebar.
- **Every command asks first.** `shellAccess` and `sshRun` wait for the user's approval, with the exact command shown (before secret substitution): Run, Run everything this turn, or Deny — a typed reply is passed to the model as the reason. Enforced in Go (`backend/tools/approval.go`), so both agent paths are covered. Approving a deployment plan approves its steps.
- **Beta and Experimental tags** on the app, the Windows setup card, the harness providers and the Neon and Supabase connectors. Cursor is Experimental and asks for a one-time acknowledgement before it's used.
- Harness system prompts now list the available skills, so `useSkill` is callable by name from Claude Code, Cursor and opencode too.
- A connector's skill is installed on connect and on a successful sign-in check, not only on install, so a CLI the user already had gets it.

### Changed

- The harness CLIs' own shell and write tools are switched off — Claude Code via `--disallowedTools`, opencode via `permission` in its inline config, Cursor via a `.cursor/cli.json` deny — so commands go through the sandboxed, approval-gated `shellAccess`.
- The local sandbox also hides `~/.kube`, `~/.azure`, gh and gcloud config, `.docker/config.json`, `.npmrc`, `.pypirc`, `.netrc`, cargo credentials and browser profiles.
- Supported platforms are macOS on Apple Silicon and Windows (experimental); the Intel, universal and Linux build scripts are gone. The macOS bundle identifier is now `in.getvibeops.app`; existing installs are asked for folder, network and notification access once more.

### Fixed

- A cancelled or timed-out `sshRun` echoed the command back to the model with its secret values already substituted.
- Cursor spawned the MCP child with a scrubbed environment, so `askQuestion` could not reach the app.

## [0.6.0] — 2026-09-25

### Added

- **OS notifications when the agent needs you.** If the window isn't focused, a sudo prompt, a secret request, an `askQuestion`, a finished turn or a failed turn raises a native notification with the app's icon; clicking it brings the window back, un-minimising it if needed. Permission is asked once at startup. `notifyIfAway` in `frontend/src/lib/notify.ts`.
- **`scripts/sign-macos.sh`** signs the macOS bundle with a stable local identity (created once, on first run). `wails build` only ad-hoc signs, and macOS pins an ad-hoc app's permission grants to its exact binary, so every build asked for folder, network and notification access again. `build.sh` and the `build-macos-*.sh` scripts now sign after building.
- A chat records the provider that ran it; a harness chat can't be continued on a different CLI, and the composer says which provider to switch back to. The composer also shows which provider the next message goes to.
- Skeleton and empty states for the overview, openers on a blank chat, press and focus feedback on buttons and switches.

### Changed

- **Graphite redesign.** Graphite is the default theme — cool neutrals, one accent, Geist + Geist Mono. The sidebar is the canvas and the pane a rounded plate on it; panels are bezels, buttons are pills; screens rise in with spring easing (reduced-motion aware). Overview gets a KPI bento.
- One type scale, one page shell (`<Page>`/`<PageHeader>`) and one panel (`<Panel>`/`<PanelRow>`) under every screen; radius derives from `--radius` everywhere.
- **Connector auth is no longer probed on open.** `CheckAll` only reports what's installed plus the last known auth result, cached in `connector-auth.json`; the real check is `CheckAuth`, run on an explicit action — `neon` and `supabase` launch a browser login when probed signed-out, so opening Settings used to pop browser windows.
- **Chat history is one file per chat** plus a small index, instead of one `sessions.json` rewritten whole twice per turn. Migrates once, renaming the old file aside.
- Routes are code-split: the initial chunk went from 2,686 kB to 351 kB. Settings no longer fetches OpenRouter's model catalogue or spawns CLI subprocesses until a provider row is opened.
- Streamed agent updates are coalesced to one render per 60 ms and the draft lives in the composer, so typing while the agent works no longer stutters.

### Fixed

- A running chat vanished when navigating away and back; transcripts now live in a store the run keeps writing to while the screen is unmounted.
- Remote `sudo` lost its cached credential and failed with "a terminal is required": the command ran last in the preamble, so the shell exec'd into it and changed pid.
- Code blocks could show another snippet's highlighting; OpenRouter outages silently gave an empty model list; an unlisted status crashed the applications table; status tints punched holes in dark mode; the zen theme leaked its palette into the others.

### Removed

- A notifications block that had been commented out for a while.

## [0.5.0] — 2026-09-18

### Added

- **Coding-harness providers.** The Claude Code integration is now a harness layer that drives whichever agent CLI the user already has — `claude`, `cursor-agent` or `opencode` — one subprocess per turn, each pointed back at `vibeops mcp` the way that CLI accepts it. `frontend/src/lib/ai/harness.ts` folds their three incompatible JSON event streams into the same `AgentResult` the OpenRouter path returns, so the assistant renders every provider identically.
- **`askQuestion`.** The agent can put a question to the user mid-run and block on the answer — over the bound `Answer` on the harness path, straight to the dialog on the OpenRouter one.
- **Visual deployment cards.** `proposeProviders` and `proposePlan` replace the markdown table and command list the deployment conversation used to produce. The providers card reads as a map — one route line per service, with the connector's logo as the destination, the tech stack as a badge row, and the reasoning collapsed behind a disclosure. The plan card describes each step in plain language with an impact tag and carries the go-ahead button. Warnings stay outside the fold.
- Deployment chats are named after the project folder or repo instead of all being “Deployment”.
- A shared markdown renderer behind the message and reasoning components, and `webview.ts` to route external links to the OS browser and repair clipboard access — both inert inside the Wails webview.
- **Neon and Supabase connectors**, alongside the existing Vercel and Cloudflare ones.
- **Windows support.** New `backend/shell` package with per-platform implementations (`shell_windows.go` runs commands through WSL, `shell_darwin.go`/`shell_unix.go` natively), replacing the ad-hoc sandbox helpers in `backend/tools/sandbox.go`. `ShellStatus` surfaces in the assistant when the shell layer isn't usable.
- **Toast notifications** (sonner) as the single place errors and confirmations reach the user, via `notifyError` / `notifySuccess` in `frontend/src/lib/notify.ts`. A global `unhandledrejection` / `error` handler catches what escapes a try/catch, which previously only landed in the devtools console nobody has open in a packaged desktop app.
- **Global keyboard shortcuts**: `⌘/Ctrl+J` for Assistant, `⌘/Ctrl+I` for Settings. Defined once in `frontend/src/hooks/use-shortcuts.ts`; the sidebar renders the hint for any route that has one.
- `Settings.ConnectConnector` — running a connector CLI's login flow is now its own backend call.
- Go test coverage for the shell layer, shell access, sudo handling and skill installation.

### Changed

- **Installing a connector and authenticating it are separate steps.** `InstallConnector` only puts the CLI on PATH (and ships its skill); `ConnectConnector` runs the login. Installed and connected are independent states, so a CLI the user installed themselves is picked up without a reinstall.
- The Connectors settings panel is self-contained — it owns its polling and per-step busy state instead of reporting errors up to the page.
- Inline error banners removed from the assistant, settings, deployment dialog, add-server dialog and connectors; all now toast.
- Frontend formatted with Prettier (whitespace-only across `frontend/src/`).

### Removed

- The `vercel` theme.
- `scripts/test-windows-build.sh`, folded into `scripts/build-windows.sh`.

## [0.1.0] — 2026-08-05

First alpha. A Wails v2 desktop app whose AI agent runs **in the frontend** and reaches the local machine through Go tool bindings.

### Added

**Agent core**

- Client-side agent loop (`frontend/src/lib/ai/agent.ts`) built on the Vercel AI SDK against OpenRouter, streaming `result.fullStream` straight into the UI via `onUpdate` snapshots. `stopWhen: stepCountIs(15)` as a runaway guard.
- Two-layer tool bridge: a Go method on the `Tool` struct, bound in `main.go`, wrapped by a `tool()` definition under `frontend/src/lib/ai/tools/` and registered in `tools/index.ts`.
- Tools: system info, command execution, shell access, SSH (`backend/tools/ssh.go`), secrets, skills, directory listing, overview generation.
- Session persistence (`backend/sessions`) on a small `backend/jsonstore` abstraction.

**Providers**

- OpenRouter provider with API key + model selection, and a model selector in the chat input.
- **Claude Code as a second AI provider** (`backend/tools/claudecode.go`, `frontend/src/lib/ai/claude-code.ts`) with streaming output.
- **Local MCP server** (`backend/mcp/server.go`) exposing VibeOps' tools to coding harnesses, so Claude Code drives the same capabilities as the AI-SDK path.
- Provider cards for Cursor and OpenCode as placeholders for the next harnesses.

**Security**

- API keys and secrets stored in the **OS keychain** via go-keyring, read at request time and never exposed to the model.
- Secret request flow: the agent asks, the user approves in a dialog, and the value is injected by the Go secret bridge (`backend/tools/secretbridge.go`) without passing through the LLM.
- Sudo password human-in-the-loop flow with a confirm dialog before privileged commands.

**Screens**

- **Overview** — services discovered over SSH plus connector apps, with status badges, sparklines, and a lazy refresh control that only regenerates on demand.
- **Assistant** (renamed from Playground) — empty state, streaming tool-call UI, reasoning and task blocks from Vercel AI Elements.
- **Settings** — providers, connectors, servers, secrets, and appearance.
- Sidebar-driven routing where `routes.tsx` is the single source of truth for pages and nav.

**Platform & polish**

- Connector installation from Settings (Vercel, Cloudflare) with skills shipped to `~/.agents/skills` so coding harnesses pick them up too.
- Deployment dialog and SSH server management (add server with key file picker).
- Selectable theme system with a saved preference applied before first paint.
- App manifest fetching, version chip, and an update check.
- Cross-platform build scripts (`scripts/build-*.sh`) and `INSTALL.md`.
- Branding: app icon, logos, and landing page.
