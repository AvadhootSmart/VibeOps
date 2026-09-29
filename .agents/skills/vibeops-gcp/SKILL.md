---
name: vibeops-gcp
description: Deploy and manage Google Cloud with the `gcloud` CLI — projects, APIs, billing, Cloud Run, Artifact Registry, Cloud Build, App Engine, Cloud Functions, Compute Engine, Cloud SQL, Secret Manager, Cloud Storage and logs. Use for any task involving a Google Cloud / GCP project, a Cloud Run deploy, or inspecting GCP resources. Prefer these exact commands over guessing flags.
---

# Google Cloud CLI

`gcloud` is the Google Cloud CLI. Commands are `gcloud <group> <subgroup> <verb>`; `gcloud <group> <verb> --help` is the authority on flags — run it instead of guessing. Some features live under `gcloud beta` / `gcloud alpha`.

## Agent / non-interactive rules (read first)

- **`--quiet` (`-q`) on every write.** It accepts defaults and skips "Do you want to continue (Y/n)?" prompts; without it a command waits on stdin forever. Anything that would need a real answer instead fails with a message saying which flag to pass — pass it.
- **Output**: `--format=json` to read values; `--format='value(field)'` for one value to feed forward, e.g. `gcloud run services describe api --region us-central1 --format='value(status.url)'`. Filter server-side with `--filter`.
- **Project and region first**: `gcloud config list --format=json` shows the active account, project and defaults. Pass `--project <id>` and `--region <r>` explicitly, or set them: `gcloud config set project <id>`, `gcloud config set run/region us-central1`. A missing region makes Cloud Run prompt (and hang without `--quiet`).
- **APIs must be enabled** per project: the error says `... API has not been used in project ... or it is disabled` — run `gcloud services enable <api> --quiet` and retry.
- **Billing**: most services need a billing account linked to the project; `gcloud billing projects describe <id>` shows it. Linking is the user's decision — ask.
- **No `--follow` / `tail`**: `gcloud beta run services logs tail` never returns; use `logs read --limit`.
- **Credentials are only readable after the user connects Google Cloud** in Settings → Connectors (VibeOps hides `~/.config/gcloud` from the shell until then). If a command reports `You do not currently have an active account` or `Reauthentication required`, ask the user to connect or re-check there. `gcloud auth login` needs a browser the user drives. On Windows (WSL) with no browser handler, gcloud falls back to a paste-the-code flow that Connect can't complete — the user runs `gcloud auth login` in their WSL terminal, then presses Check sign-in.
- **Secrets**: never run `gcloud secrets versions access`, `gcloud auth print-access-token`, `sql users` commands that echo passwords, or anything that prints a service-account key. Use `secretRequest` and `$SECRET_<NAME>`, or generate values in-command.

## Blast radius (VibeOps severity tags)

- `[SAFE]` — `config list`, `auth list`, `projects list/describe`, every `list` / `describe`, `services list`, `logging read`, `run services logs read`, `builds list/log`, `billing projects describe`.
- `[CAUTION]` — `projects create`, `services enable`, `run deploy` (new revision takes traffic), `builds submit`, `app deploy`, `functions deploy`, `sql instances create`, `secrets create` / `versions add`, `storage rsync` without `--delete-unmatched-destination-objects`, IAM bindings that grant `allUsers` (public). Creates **cost money** — say so.
- `[DESTRUCTIVE]` — any `delete`, `projects delete`, `run services update-traffic` (moves prod traffic), `storage rm -r`, `storage rsync --delete-unmatched-destination-objects`, `sql instances delete`, `compute instances delete`, `iam service-accounts keys create` (mints a long-lived secret). Never without explicit approval.

## Identity and projects

```bash
gcloud config list --format=json                          # account, project, region
gcloud auth list --format=json                            # which accounts are signed in
gcloud auth login                                         # browser flow — VibeOps' Connect runs it
gcloud auth application-default login                     # ADC for SDKs, Terraform, local libraries (user runs it)
gcloud projects list --format="table(projectId,name,projectNumber)"
gcloud projects create my-app-12345 --name="My App" --quiet
gcloud config set project my-app-12345
gcloud billing accounts list
gcloud billing projects link my-app-12345 --billing-account=XXXXXX-XXXXXX-XXXXXX    # ask first
```

Project IDs are globally unique, 6–30 chars, lowercase letters/digits/hyphens — add a numeric suffix.

## Cloud Run (the default for containers and web apps)

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --quiet
gcloud run deploy my-app --source . --region us-central1 --allow-unauthenticated --quiet     # builds via Cloud Build, no local docker
gcloud run deploy my-app --image us-central1-docker.pkg.dev/PROJECT/repo/my-app:v2 --region us-central1 --quiet
gcloud run services list --format="table(metadata.name,status.url,status.conditions[0].status)"
gcloud run services describe my-app --region us-central1 --format='value(status.url)'
gcloud run services update my-app --region us-central1 --update-env-vars NODE_ENV=production --quiet
gcloud run services update my-app --region us-central1 --update-secrets DATABASE_URL=DATABASE_URL:latest --quiet
gcloud run revisions list --service my-app --region us-central1
gcloud run services update-traffic my-app --region us-central1 --to-revisions my-app-00005-abc=100      # DESTRUCTIVE rollback/cutover
```

The container must listen on `$PORT` (default 8080). `--allow-unauthenticated` makes the service public — say so in the plan. `--update-env-vars` merges; `--set-env-vars` **replaces** all of them. `--source .` uses a Dockerfile if present, otherwise buildpacks.

## Artifact Registry and Cloud Build

```bash
gcloud artifacts repositories create repo --repository-format=docker --location=us-central1 --quiet
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
gcloud builds submit --tag us-central1-docker.pkg.dev/PROJECT/repo/my-app:v2 .     # cloud build, no platform mismatch
gcloud builds list --limit 5
gcloud builds log <build-id>
```

Local `docker build` on Apple Silicon needs `--platform linux/amd64` for Cloud Run; `gcloud builds submit` avoids that entirely.

## App Engine and Cloud Functions

```bash
gcloud app deploy app.yaml --quiet
gcloud app browse --no-launch-browser
gcloud functions deploy my-fn --gen2 --runtime nodejs20 --region us-central1 --source . --entry-point handler --trigger-http --allow-unauthenticated --quiet
gcloud functions describe my-fn --region us-central1 --format='value(serviceConfig.uri)'
```

App Engine's region is permanent once `gcloud app create --region` is run — confirm it with the user.

## Secret Manager

```bash
gcloud services enable secretmanager.googleapis.com --quiet
printf %s $SECRET_DATABASE_URL | gcloud secrets create DATABASE_URL --data-file=- --quiet
printf %s $SECRET_DATABASE_URL | gcloud secrets versions add DATABASE_URL --data-file=-
gcloud secrets list --format="value(name)"
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:$(gcloud projects describe PROJECT --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor --quiet
```

Use `printf %s`, not `echo`: a trailing newline becomes part of the secret. Never read versions back.

## Cloud SQL

```bash
gcloud services enable sqladmin.googleapis.com --quiet
gcloud sql instances create my-pg --database-version=POSTGRES_16 --tier=db-f1-micro --region=us-central1 --quiet
gcloud sql databases create appdb --instance=my-pg
pw=$(openssl rand -hex 24); \
gcloud sql users create app --instance=my-pg --password="$pw" >/dev/null && \
printf 'postgresql://app:%s@/appdb?host=/cloudsql/PROJECT:us-central1:my-pg' "$pw" | gcloud secrets create DATABASE_URL --data-file=- --quiet
gcloud run services update my-app --region us-central1 --add-cloudsql-instances PROJECT:us-central1:my-pg --quiet
gcloud sql instances list
```

Instance creation takes several minutes. Cloud Run reaches Cloud SQL through the Unix socket at `/cloudsql/<connection-name>` once `--add-cloudsql-instances` is set.

## Cloud Storage (static assets)

```bash
gcloud storage buckets create gs://my-site-assets --location=us-central1 --uniform-bucket-level-access
gcloud storage rsync ./dist gs://my-site-assets --recursive
gcloud storage ls gs://my-site-assets
gcloud storage buckets add-iam-policy-binding gs://my-site-assets --member=allUsers --role=roles/storage.objectViewer   # CAUTION: public
```

## Compute Engine

```bash
gcloud compute instances list --format="table(name,zone.basename(),status,networkInterfaces[0].accessConfigs[0].natIP)"
gcloud compute instances start|stop|reset my-vm --zone us-central1-a
gcloud compute firewall-rules list
```

To work on a VM, use `sshConnect` / `sshRun` against its external IP; `gcloud compute ssh` is interactive and manages keys itself — avoid it here.

## Logs and debugging

```bash
gcloud run services logs read my-app --region us-central1 --limit 100
gcloud logging read 'resource.type="cloud_run_revision" AND severity>=ERROR' --limit 50 --freshness 1h --format=json
gcloud builds log $(gcloud builds list --limit 1 --format='value(id)')
```

## Typical flows

**Deploy a repo to Cloud Run:** `gcloud config list` → confirm project + billing → `services enable run artifactregistry cloudbuild` → `gcloud run deploy <svc> --source . --region <r> --quiet` → `describe --format='value(status.url)'` → `curl -I <url>` → `logs read --limit 50` if it fails.

**Add a secret to a running service:** `printf %s $SECRET_X | gcloud secrets create X --data-file=-` → grant `secretAccessor` to the service's account → `run services update --update-secrets X=X:latest`.

## Gotchas

- `PERMISSION_DENIED` names the missing permission — report it; don't grant IAM roles to fix it without asking.
- The default Cloud Run / Compute service account is `<projectNumber>-compute@developer.gserviceaccount.com` — project **number**, not ID.
- `gcloud` stores settings per *configuration*; `gcloud config configurations list` shows them if the active project looks wrong.
