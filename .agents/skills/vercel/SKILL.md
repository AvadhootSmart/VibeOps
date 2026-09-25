---
name: vercel
description: Deploy and manage projects on Vercel with the `vercel` CLI (aka `vc`) — deployments, env vars, project linking, logs, rollbacks, and domains. Use for any task involving Vercel deploys, preview/production releases, environment variables, or inspecting a Vercel project. Prefer these exact commands over guessing flags.
---

# Vercel CLI

The `vercel` CLI (alias `vc`) deploys and manages projects on Vercel. Tested against **CLI v57**. Run any command with `--help` to confirm flags before relying on them — subcommands evolve.

## Agent / non-interactive rules (read first)

- The CLI auto-detects agents and defaults to `--non-interactive`. Still, **always pass `--yes`** on commands that would otherwise prompt (`pull`, `link`, `deploy` on a new project) so nothing hangs waiting for input.
- Auth: the CLI uses the logged-in session, or `--token <TOKEN>` / the `VERCEL_TOKEN` env var. Never print a token. Check auth with `vercel whoami`.
- Scope (team/personal): append `--scope <team-slug>` when the project isn't under the default scope.
- A directory must be **linked** to a project before most commands work. `vercel link --yes` links the cwd; `.vercel/project.json` is the marker that it's already linked.

## Blast radius (VibeOps severity tags)

When proposing a plan, tag Vercel commands like any other:

- `[SAFE]` — `whoami`, `list`/`ls`, `inspect`, `logs`, `env ls`, `pull`, `deploy --dry`, any preview deploy.
- `[CAUTION]` — `env add/rm/update`, `link`, `alias`, `domains`, `promote` (shifts prod traffic).
- `[DESTRUCTIVE]` — `--prod` production deploys, `rollback`, `redeploy --prod`, `rm` (removes a deployment), `firewall` changes. These affect live traffic — never run without approval.

## Core commands

### Deploy
```bash
vercel deploy --dry                 # inspect detected framework + files, no upload (SAFE)
vercel                              # preview deploy of cwd (deploy is the default cmd)
vercel --prod                       # PRODUCTION deploy (shorthand for --target=production)
vercel --prebuilt                   # deploy an existing ./.vercel/output from `vercel build`
vercel --logs                       # stream build logs during the deploy
vercel deploy -e KEY=val -b KEY=val # runtime (-e) and build-time (-b) env overrides
vercel --no-wait                    # return immediately, don't wait for build to finish
```
Deploy prints the deployment URL on stdout. Preview deploys are safe and cheap — use one to validate before ever proposing `--prod`.

### Build locally
```bash
vercel build           # build into ./.vercel/output; pair with `vercel deploy --prebuilt`
vercel build --prod    # production build
```

### Environment variables
```bash
vercel env ls [environment]                       # list (SAFE)
vercel env pull .env.local                         # write dev env vars to a file (SAFE)
vercel env add   NAME [production|preview|development] [git-branch]   # value read from stdin
vercel env rm    NAME [environment] --yes
vercel env update NAME [environment]
```
`env add` reads the **value from stdin** — pipe it, never put a secret in the command string (matches VibeOps' sudo-password rule). Example: `printf '%s' "$VALUE" | vercel env add API_KEY production`.

### Link / pull project settings
```bash
vercel link --yes                                  # link cwd to a project
vercel link --project <name> --yes                 # non-interactive link to a named project
vercel pull --yes                                  # pull .vercel/project.json + env (development)
vercel pull --environment=production --yes
```

### Inspect / observe (all SAFE)
```bash
vercel ls [app]              # list recent deployments
vercel inspect <url|id>      # details for one deployment
vercel logs <url>            # runtime logs for a deployment
vercel whoami                # current user
vercel projects ls           # list projects in scope
```

### Release management (CAUTION / DESTRUCTIVE)
```bash
vercel promote <url|id>      # promote an existing deployment to current production
vercel rollback <url|id>     # revert production to a previous deployment
vercel redeploy <url|id>     # rebuild + redeploy a past deployment
vercel alias set <url> <domain>   # point a domain at a deployment
vercel rm <id> --yes         # remove a deployment
```

## Typical flows

**Ship to preview, then production:**
```bash
vercel link --yes
vercel pull --yes
vercel deploy --dry            # confirm framework detection
vercel                         # preview URL — verify it
vercel --prod                  # only after approval
```

**Fast rollback of a bad prod release:**
```bash
vercel ls                      # find the last-good deployment URL
vercel rollback <good-url>     # DESTRUCTIVE — shifts prod traffic
```

## Notes

- `vercel agent init` generates an `AGENTS.md` of Vercel best practices for a repo — useful when onboarding a new project.
- `vercel skills <query>` surfaces Vercel-side agent skills relevant to the current project.
- Output format: add `-F json` / `--format json` where supported (e.g. `deploy`) for machine-parseable results.
- Full command list: `vercel --help`; per-command flags: `vercel <cmd> --help`. When unsure, run the `--help` — don't invent flags.
