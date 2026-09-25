# Deployments

## The flow

The dialog collects the minimum, and the conversation does the rest — because
the agent can only propose a sane target *after* it has read the project.

1. **Source** — a local folder (native picker) or a GitHub repo. These are not
   two flows: a repo is `App.CloneRepo` into the workspaces folder in front of
   the local-folder flow. `App.WorkspacesDir` resolves and creates it, and hands
   back an **absolute** path — `~` only expands unquoted, so an agent writing
   `cd "~/VibeOps/workspaces"` would silently create a directory named `~`.
2. **Target** — optional. "Let VibeOps decide after scanning" is the default;
   otherwise pick an allowed server or an installed connector.
3. **Hand off** — the dialog clones (if needed), calls `App.ChangeCwd` on the
   project directory, then navigates to `/assistant?prompt=…&hidden=1`, which
   auto-starts a fresh chat.

Checkout and `cd` are the **app's** job, not the conversation's. `ChangeCwd` is
`os.Chdir` on the process, so every `ShellAccess` and the Claude Code child
inherit it — the agent never needs a `cd`, and can't drift into the wrong
directory between calls (each shell command is its own `sh -c`, so a `cd` inside
one wouldn't survive to the next anyway). One project at a time; concurrent
deployments would need per-run working directories.

`hidden=1` keeps the handoff prompt out of the transcript — the user asked for a
deployment, not for a wall of instructions. The turn is stored with
`hidden: true` and the user bubble is skipped, so the chat opens on the agent's
reply, and the session is named "Deployment" rather than the prompt's first 80
characters.

The agent then: scans the repo for **every deployable service** (frontend, API,
worker, cron, DB) → replies with a summary paragraph, a one-row-per-service
table and providers ranked per service (and says plainly when a service can't
run on a target, rather than working around it) → requests the env vars each
service needs → presents the full plan, grouped by service and ordered so a
service ships before whatever needs its URL, tagged by blast radius → waits for
approval → runs it → calls `generateOverview`.

Per service, not per repo: a Next.js frontend and a Go API that shells out to
`ffmpeg` belong on different providers, and a single "deploy to X" answer either
strands the frontend on a VM or pretends the API fits on serverless. The picked
target in the dialog is a preference the agent applies where it fits, not a
constraint it works around.

Target selection comes **after** the scan on purpose. Asking first creates a
dead end where the user picks something the stack can't run on, which then needs
a warning and a do-over.

## Secrets

Env vars, DB passwords and connection strings must never touch the LLM layer —
prompts and tool results are observable, so a secret in context is a published
secret. This is the whole security story, and it's the same machinery as sudo:
the agent calls `secretRequest(name, reason)`, the user answers a dialog, and
the agent only ever writes `$SECRET_<NAME>`, substituted at execution time and
scrubbed back out of command output.

See [secret-request-flow.md](secret-request-flow.md). It applies to values the
agent *derives* too — after provisioning a database, the connection string is
set on the deploy target directly, never printed.

## Launch environment

Every CLI the agent shells out to (`claude`, `bunx`, `wrangler`, `vercel`) is
found via PATH. A `.app` launched from Finder inherits launchd's minimal
`/usr/bin:/bin:/usr/sbin:/sbin`, so none of them resolve — while `wails dev`,
launched from a terminal, works fine and hides the problem completely.

`adoptLoginPATH` in `main.go` fixes it once on the process itself, before
anything looks up a binary. The shell runs `-ilc`: **interactive** matters,
because version managers (bun, volta, nvm) write their PATH edits to `.zshrc`,
which a login-only shell never sources.

## Deliberately not built yet

- **Domain configuration.** Connectors hand out a working URL; custom domains
  mean DNS + TLS + a VM path. v1 ends at `*.workers.dev` / `*.vercel.app`.
- **A local deployment record.** The provider owns deployment state; mirroring
  it means drift. The Overview snapshot is the list. When per-deployment detail
  is needed, extend `overview.json` rather than adding a parallel store.
- **A provider matrix.** Cloudflare (`wrangler`) and Vercel are the connectors
  that exist. Neon, Supabase, Mongo Atlas, AWS are all `bunx <cli>` away — the
  agent has shell access, so they cost nothing to add later and a lot to design
  for now.
- **Bundled CLI binaries.** Per-platform packaging, notarization and version
  drift for every provider, to save a `bunx`. No.
- **Per-provider DB tools.** N providers × M operations of hand-written tooling
  that the generic secret mechanism already covers.
- **Edit / delete deployment.** Belongs to the provider. "Delete" is a prompt.
