---
name: neon
description: Provision and manage Neon serverless Postgres with the `neon` CLI (aka `neonctl`) — projects, branches, databases, roles, connection strings, and psql. Use for any task involving a Neon database, database branching, or getting a Postgres connection string for a deployment. Prefer these exact commands over guessing flags.
---

# Neon CLI

`neon` (alias `neonctl`, same binary) manages Neon serverless Postgres. Install: `npm i -g neon`. Run any command with `--help` to confirm flags before relying on them.

## Agent / non-interactive rules (read first)

- **Auth**: `neon auth` opens a browser OAuth flow (interactive — the user runs it, VibeOps' Connect button does it for you). Non-interactive: `NEON_API_KEY` env var or `--api-key <key>`. Precedence: `--api-key` → `NEON_API_KEY` → `~/.config/neonctl/credentials.json` → browser. Check auth with `neon me`.
- **`--output json` on everything.** Default output is an ASCII table; always add `--output json` when you need to read a value out of the result.
- **Context**: `neon set-context --project-id <id>` (or `neon link` in a project dir) writes a `.neon` file so you can drop `--project-id` from later commands. Without it, pass `--project-id` explicitly — the CLI otherwise prompts, which hangs.
- **Org accounts**: pass `--org-id org-xxx` to `projects list/create`.
- **Connection strings are secrets.** They embed the role password. Never print one into the chat — pipe it straight into the target (`vercel env add`, `wrangler secret put`, `supabase secrets set`) or hand it to `secretRequest`.

## Blast radius (VibeOps severity tags)

- `[SAFE]` — `me`, `projects list/get`, `branches list`, `databases list`, `roles list`, `connection-string`, `inspect *`.
- `[CAUTION]` — `projects create`, `branches create`, `databases create`, `roles create`, `set-context`, `link`, `snapshots create`.
- `[DESTRUCTIVE]` — `projects delete`, `branches delete`, `branches reset`, `branches restore`, `branches set-default`, `databases delete`, `roles delete`, `api-keys revoke`, any `psql` running DDL/DML. `reset` and `restore` discard data on the target branch — never without approval.

## Core commands

### Auth / identity
```bash
neon auth                    # browser OAuth (interactive)
neon me                      # current user — the auth gate
neon api-keys list
neon api-keys create --name ci     # prints the key ONCE; treat as a secret
```

### Projects
```bash
neon projects list --output json
neon projects list --org-id org-xxxx-xxxx
neon projects create --name my-app --region-id aws-us-east-1 --output json
neon projects create --name my-app --pg-version 17 --database appdb --set-context
neon projects get <project-id> --output json
neon projects delete <project-id>          # DESTRUCTIVE
```
Defaults on create: region `aws-us-east-2`, Postgres 18, database `neondb`, role `<database>_owner`. `--cu "0.5-3"` sets the autoscaling compute range.

### Branches (the reason to pick Neon)
```bash
neon branches list --project-id <id> --output json
neon branches create --name preview-pr-42 --parent main --output json
neon branches create --name schema-test --schema-only     # schema, no data
neon branches delete <id|name>                             # DESTRUCTIVE
neon branches reset <id|name> --parent                     # DESTRUCTIVE — discards branch changes
neon branches restore <target> <source>[@timestamp|@lsn] --preserve-under-name backup
neon branches set-default <id|name>                        # DESTRUCTIVE — moves prod
```
A branch is a copy-on-write clone with its own connection string. The standard preview flow: one branch per PR/preview deploy, delete it when the preview dies.

### Connection strings
```bash
neon connection-string [branch] --output json
neon connection-string --pooled            # -pooler host; use for serverless/edge runtimes
neon connection-string --prisma            # adds Prisma's 30s connect timeout
neon connection-string mybranch --database-name appdb --role-name appdb_owner
neon connection-string --endpoint-type read_only   # read replica
```
Rule of thumb: **pooled** for Vercel/Workers/serverless (many short-lived connections), **direct** for migrations and long-running processes.

### Databases / roles
```bash
neon databases list --output json
neon databases create --name appdb
neon databases delete appdb                # DESTRUCTIVE
neon roles list --output json
neon roles create --name app_user          # password is generated; read it via connection-string
```

### SQL / inspection
```bash
neon psql                                   # psql into the default branch
neon connection-string --psql -- -f dump.sql
neon inspect db table-sizes
neon inspect db locks
neon inspect db calls                       # slowest queries (needs pg_stat_statements)
```

## Typical flows

**Provision a DB for a new deployment:**
```bash
neon me                                              # confirm auth
neon projects create --name my-app --output json     # capture project id + connection uri
neon connection-string --pooled                      # pipe into the host's env, never print
```

**Per-preview branch, then clean up:**
```bash
neon branches create --name pr-42 --parent main --output json
neon connection-string pr-42 --pooled
# ... preview deploy runs against it ...
neon branches delete pr-42                           # DESTRUCTIVE, but scoped to the preview
```

**Recover from a bad migration:**
```bash
neon branches list --output json                     # find the branch + a good timestamp
neon branches restore main ^self@2026-08-07T10:00:00Z --preserve-under-name main-before-restore
```

## Notes

- `neon connection-string` resolves the project from context; without a `.neon` file or `--project-id` it prompts — set context first in any scripted flow.
- Point-in-time syntax `branch@timestamp` / `branch@lsn` works for both `connection-string` and `branches restore`.
- Full command list: `neon --help`; per-command flags: `neon <cmd> --help`. When unsure, run the `--help` — don't invent flags.
