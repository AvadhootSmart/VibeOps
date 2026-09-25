---
name: supabase
description: Manage Supabase projects with the `supabase` CLI — linking, database migrations (db push/pull/diff), edge functions, secrets, storage, and local dev stack. Use for any task involving a Supabase project, Postgres migrations, edge function deploys, or Supabase auth/storage config. Prefer these exact commands over guessing flags.
---

# Supabase CLI

`supabase` manages Supabase projects — hosted and local. Install: `npm i -g supabase` (Supabase officially recommends a dev-dependency + `npx supabase`; the global install is what VibeOps' connector uses so the agent has a bare `supabase` on PATH). Run any command with `--help` to confirm flags.

## Agent / non-interactive rules (read first)

- **Auth**: `supabase login` opens a browser (interactive). Non-interactive: `SUPABASE_ACCESS_TOKEN` env var, or `supabase login --token <pat>` (token from https://supabase.com/dashboard/account/tokens). There is **no `whoami`** — `supabase projects list` is the auth gate: it exits non-zero when unauthenticated.
- **`--yes` on anything that prompts**, and `-o json` (global flag: `env|pretty|json|toml|yaml`) whenever you need to read a value out of the output.
- **Most commands need a linked project.** `supabase link --project-ref <ref>` writes `supabase/.temp`; the `supabase/` directory is the marker a repo is initialized (`supabase init` creates it). Unlinked commands take `--project-ref` or `--db-url` instead of `--linked`.
- **DB password**: `SUPABASE_DB_PASSWORD` env var, or `-p`. Never put it in a command string that gets echoed.
- **Local stack needs Docker.** `supabase start` boots Postgres/Auth/Storage/Studio in containers — don't propose it on a machine without Docker running.

## Blast radius (VibeOps severity tags)

- `[SAFE]` — `projects list`, `orgs list`, `functions list`, `secrets list` (names only), `migration list`, `db diff`, `db push --dry-run`, `status`, `inspect *`.
- `[CAUTION]` — `link`, `init`, `start`/`stop`, `migration new`, `db pull`, `functions deploy`, `secrets set`, `projects create`, `gen types`.
- `[DESTRUCTIVE]` — `db push --linked` (runs migrations on prod), `db reset --linked`, `migration up --linked`, `secrets unset`, `projects delete`, `functions delete`, `db push --include-all`. Anything with `--linked` or `--db-url` touches the live database — never without approval.

## Core commands

### Auth / projects
```bash
supabase login --token "$SUPABASE_ACCESS_TOKEN"   # or bare `supabase login` for browser
supabase projects list -o json                     # also the auth gate (SAFE)
supabase projects create my-app --org-id <org> --region us-east-1 --db-password "$PW"
supabase projects api-keys --project-ref <ref> -o json   # anon + service_role keys — SECRETS
supabase orgs list -o json
```
`projects api-keys` returns the `service_role` key, which bypasses RLS. Treat it exactly like a password: pipe it into the target's env, never print it.

### Link a repo
```bash
supabase init                       # creates supabase/ (config.toml, migrations/)
supabase link --project-ref <ref>   # -p "$SUPABASE_DB_PASSWORD" if it prompts
```

### Migrations (the main risk surface)
```bash
supabase migration new add_users            # writes supabase/migrations/<ts>_add_users.sql
supabase migration list --linked            # local vs remote history (SAFE)
supabase db diff -f add_users               # capture local schema changes as a migration
supabase db pull --linked                   # remote schema -> new local migration
supabase db push --linked --dry-run         # SAFE preview — always run this first
supabase db push --linked                   # DESTRUCTIVE — applies to the live DB
supabase db reset --local                   # rebuild local DB from migrations + seed
```
First `db push` creates `supabase_migrations.schema_migrations` on the remote. Order is non-negotiable: `diff`/`new` → review the SQL → `push --dry-run` → approval → `push`.

### Edge functions
```bash
supabase functions new hello
supabase functions serve                       # local, with hot reload
supabase functions deploy hello --project-ref <ref>
supabase functions deploy                      # all functions
supabase functions deploy --use-api            # bundle server-side, no Docker needed
supabase functions deploy --no-verify-jwt      # public endpoint — say so explicitly
supabase functions list --project-ref <ref>
supabase functions delete hello                # DESTRUCTIVE
```
`--prune` deletes remote functions absent locally — DESTRUCTIVE, call it out.

### Secrets (edge function env)
```bash
supabase secrets list --project-ref <ref>          # names + digests, never values (SAFE)
supabase secrets set KEY=value --project-ref <ref>
supabase secrets set --env-file ./.env.production  # preferred: keeps values out of argv
supabase secrets unset KEY                          # DESTRUCTIVE
```
Prefer `--env-file` over inline `KEY=value` — argv is visible to other processes and lands in shell history.

### Local dev / types / inspect
```bash
supabase start                                  # boots the local stack (needs Docker)
supabase status -o env                          # local URL + keys as env vars
supabase stop --no-backup
supabase gen types typescript --linked > src/database.types.ts
supabase inspect db table-sizes --linked
supabase inspect db long-running-queries --linked
```

## Typical flows

**Wire a new project into a repo:**
```bash
supabase projects list -o json           # confirm auth, find the ref
supabase init
supabase link --project-ref <ref>
supabase db pull --linked                # baseline the existing schema
```

**Ship a schema change:**
```bash
supabase migration new add_orders
# edit supabase/migrations/<ts>_add_orders.sql
supabase db reset --local                # verify it applies cleanly from scratch
supabase db push --linked --dry-run      # SAFE
supabase db push --linked                # DESTRUCTIVE — after approval only
```

**Deploy an edge function with config:**
```bash
supabase secrets set --env-file ./.env.production --project-ref <ref>
supabase functions deploy hello --project-ref <ref>
supabase functions list --project-ref <ref>
```

## Notes

- Connection strings: the pooler URL (port 6543, `?pgbouncer=true`) is for serverless/edge; the direct URL (port 5432) is for migrations. Wrong one = exhausted connections or a migration that silently can't run.
- `supabase db push` has no rollback. The recovery path is a new forward migration, so review the SQL before pushing, not after.
- Full command list: `supabase --help`; per-command flags: `supabase <cmd> --help`. When unsure, run the `--help` — don't invent flags.
