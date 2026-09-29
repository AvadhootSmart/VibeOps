---
name: vibeops-mongodb-atlas
description: Provision and manage MongoDB Atlas with the `atlas` CLI — organizations, projects, clusters (including the free M0 tier), database users, IP access lists, connection strings, backups, search indexes and local Atlas deployments. Use for any task involving a MongoDB Atlas database or getting a MongoDB connection string for a deployment. Prefer these exact commands over guessing flags.
---

# MongoDB Atlas CLI

`atlas` manages MongoDB Atlas. Flags are **camelCase** (`--projectId`, `--orgId`, `--clusterName`) — unlike most CLIs. `atlas <command> --help` is the authority on flags; run it instead of guessing.

## Agent / non-interactive rules (read first)

- **`-o json` on everything you need to read.** The default is a table.
- **`--force` on every delete** and any command that asks for confirmation; otherwise it waits on stdin.
- **Project scope**: nearly every command needs a project. Pass `--projectId <id>` explicitly, or set a default once with `atlas config set project_id <id>` (`org_id` likewise). Without either, the CLI errors or prompts.
- **Never run the interactive setup commands** — `atlas setup`, `atlas quickstart`, `atlas config init`, plain `atlas auth login`. They use terminal prompts that hang here. Use the explicit commands below instead.
- **Auth**: `atlas projects list -o json` is the real gate — `atlas auth whoami` only reads the local config, so it still passes after the session has expired. VibeOps' Connect runs `atlas auth login --force --skipConfig` (browser device-code flow). Programmatic access uses `MONGODB_ATLAS_PUBLIC_API_KEY` / `MONGODB_ATLAS_PRIVATE_API_KEY` (or a service account's `MONGODB_ATLAS_CLIENT_ID` / `MONGODB_ATLAS_CLIENT_SECRET`) — pass those as `$SECRET_` env vars, never in chat.
- **Credentials live in the config file under VibeOps.** On macOS, VibeOps runs `atlas` with the Keychain unavailable, so the login is kept in `atlas`' config file where this shell can read it. The `Warning: Secure storage is not available, falling back to insecure storage` line on every command is expected — ignore it. If `atlas` says `not logged in` although the user signed in from their own terminal (that login lives in the Keychain), ask them to press **Connect** on MongoDB Atlas in Settings → Connectors.
- **Connection strings + passwords are secrets.** `atlas clusters connectionStrings describe` returns a URI **without** credentials — that part is safe to read. The password is what must never be printed: generate it in the command and pipe the full URI straight into the destination (see "Wire a cluster into an app").

## Blast radius (VibeOps severity tags)

- `[SAFE]` — `auth whoami`, `orgs list`, `projects list/describe`, `clusters list/describe`, `clusters connectionStrings describe`, `dbusers list`, `accessLists list`, `backups snapshots list`, `metrics`, `clusters indexes list`, `alerts list`.
- `[CAUTION]` — `projects create`, `clusters create` (paid tiers cost money — name the tier), `dbusers create/update`, `accessLists create`, `clusters pause/start`, `clusters update` (tier changes), `clusters search indexes create`, `backups snapshots create`, `config set`.
- `[DESTRUCTIVE]` — `clusters delete`, `projects delete`, `dbusers delete`, `accessLists delete`, `backups restores start` (overwrites the target cluster's data), `clusters upgrade`, any `accessLists create 0.0.0.0/0` (opens the DB to the internet). Never without explicit approval.

## Orgs, projects and defaults

```bash
atlas auth whoami                                              # who the local config says (not a live check)
atlas orgs list -o json
atlas projects list -o json
atlas projects create my-app --orgId <orgId> -o json          # capture .id
atlas config set project_id <projectId>
atlas config describe default -o json                          # current profile defaults (no secrets shown)
```

## Clusters

```bash
# Free tier (one M0 per project): provider AWS|GCP|AZURE, region in Atlas' UPPER_SNAKE format
atlas clusters create my-cluster --provider AWS --region US_EAST_1 --tier M0 --projectId <id>
# Dedicated
atlas clusters create my-cluster --provider AWS --region US_EAST_1 --tier M10 --diskSizeGB 10 --mdbVersion 8.0 --projectId <id>
atlas clusters watch my-cluster --projectId <id>               # blocks until IDLE (M0: ~1–3 min, M10+: ~7–10 min)
atlas clusters list --projectId <id> -o json
atlas clusters describe my-cluster --projectId <id> -o json
atlas clusters pause my-cluster --projectId <id>               # M10+ only
atlas clusters start my-cluster --projectId <id>
atlas clusters delete my-cluster --projectId <id> --force      # DESTRUCTIVE
```

Region names: `US_EAST_1`, `US_WEST_2`, `EU_WEST_1`, `AP_SOUTH_1` on AWS; `CENTRAL_US`, `WESTERN_EUROPE` on GCP; `US_EAST_2`, `EUROPE_WEST` on Azure. Put the cluster in the same cloud region as the app host to keep latency low (Vercel's default is `iad1` → `US_EAST_1`).

## Connection strings

```bash
atlas clusters connectionStrings describe my-cluster --projectId <id> -o json
# → {"standardSrv": "mongodb+srv://my-cluster.abcde.mongodb.net", ...}
atlas clusters connectionStrings describe my-cluster --projectId <id> -o json | jq -r .standardSrv
```

The full application URI is `mongodb+srv://<user>:<password>@<host>/<db>?retryWrites=true&w=majority&appName=<app>`.

## Database users

```bash
atlas dbusers list --projectId <id> -o json                    # usernames + roles, no passwords
atlas dbusers create --username app --password $SECRET_MONGO_PASSWORD --role readWrite@appdb --projectId <id>
atlas dbusers create readWriteAnyDatabase --username admin --password $SECRET_MONGO_ADMIN_PASSWORD --projectId <id>
atlas dbusers update app --password $SECRET_MONGO_PASSWORD --projectId <id>
atlas dbusers delete app --projectId <id> --force              # DESTRUCTIVE
```

Scope app users to their database (`--role readWrite@appdb`), not `atlasAdmin`. Generated passwords should be hex/alphanumeric so they need no URL-encoding inside the URI.

## Network access (IP access list)

```bash
atlas accessLists list --projectId <id> -o json
atlas accessLists create --currentIp --comment "dev machine" --projectId <id>
atlas accessLists create 203.0.113.10 --type ipAddress --comment "prod server" --projectId <id>
atlas accessLists create 0.0.0.0/0 --type cidrBlock --comment "serverless host" --projectId <id>   # DESTRUCTIVE-level exposure
atlas accessLists delete 203.0.113.10 --projectId <id> --force
```

Serverless hosts (Vercel, Cloudflare Workers, Cloud Run, Lambda) have no fixed egress IP, so they need `0.0.0.0/0` unless the user sets up private networking or a static egress. Say this explicitly in the plan and rely on a strong password — don't add it silently. A connection timeout (not an auth error) almost always means the caller's IP isn't on the list.

## Wire a cluster into an app (password never printed)

```bash
host=$(atlas clusters connectionStrings describe my-cluster --projectId <id> -o json | jq -r .standardSrv | sed 's#mongodb+srv://##'); \
pw=$(openssl rand -hex 24); \
atlas dbusers create --username app --password "$pw" --role readWrite@appdb --projectId <id> >/dev/null && \
printf 'mongodb+srv://app:%s@%s/appdb?retryWrites=true&w=majority' "$pw" "$host" | vercel env add MONGODB_URI production
```

Swap the last command for the host's own secret store: `wrangler secret put MONGODB_URI`, `gcloud secrets create MONGODB_URI --data-file=-`, `az keyvault secret set ... --file /dev/stdin -o none`, `aws secretsmanager create-secret --name MONGODB_URI --secret-string "$(cat)"`. If the user already has a password, use `secretRequest` and `$SECRET_MONGO_PASSWORD` in `printf` instead of generating one.

## Backups, indexes, monitoring

```bash
atlas backups snapshots list my-cluster --projectId <id> -o json         # M10+ (M0 has no cloud backups)
atlas backups snapshots create my-cluster --desc "before migration" --projectId <id>
atlas clusters indexes create --clusterName my-cluster --db appdb --collection users --key email:1 --unique --projectId <id>
atlas clusters search indexes list --clusterName my-cluster --db appdb --collection posts --projectId <id> -o json
atlas clusters search indexes create --clusterName my-cluster --file search-index.json --projectId <id>
atlas alerts list --status OPEN --projectId <id> -o json
atlas metrics processes <hostname:port> --granularity PT1M --period PT1H --projectId <id> -o json
```

Take a snapshot before any migration on a dedicated cluster; propose it in the plan.

## Local development

```bash
atlas deployments setup local-dev --type local --force        # needs Docker (or Podman) running
atlas deployments list -o json
atlas deployments connect local-dev --connectWith connectionString
atlas deployments pause local-dev / start local-dev / delete local-dev --force
```

A local deployment is a single-node Atlas with Search support — good for developing against Atlas Search without a cloud cluster.

## Typical flows

**Free database for a new deployment:**
```bash
atlas projects list -o json                                     # live auth check + existing projects
atlas projects create my-app --orgId <orgId> -o json            # or reuse an existing project
atlas clusters create my-app-db --provider AWS --region US_EAST_1 --tier M0 --projectId <id>
atlas clusters watch my-app-db --projectId <id>
atlas accessLists create 0.0.0.0/0 --type cidrBlock --comment "vercel" --projectId <id>    # stated in the plan
# then "Wire a cluster into an app" above
```

## Gotchas

- M0/Flex clusters don't support `pause`, cloud backups, or some metrics; M0 is limited to one per project and 512 MB.
- `atlas clusters create` returns before the cluster is usable — always `atlas clusters watch` before creating users' URIs or connecting.
- `bad auth : authentication failed` is a user/password/authSource problem; `Server selection timed out` is the IP access list.
- `atlas` profiles live in the CLI's own config dir (not in `~/.aws` etc.); `--profile <name>` switches between them.
