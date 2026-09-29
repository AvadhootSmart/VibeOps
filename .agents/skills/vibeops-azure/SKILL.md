---
name: vibeops-azure
description: Deploy and manage Microsoft Azure with the `az` CLI — subscriptions, resource groups, App Service web apps, Container Apps, Container Registry, Static Web Apps, Functions, PostgreSQL flexible server, Key Vault and logs. Use for any task involving an Azure subscription, an Azure deploy, or inspecting Azure resources. Prefer these exact commands over guessing flags.
---

# Azure CLI

`az` is the Azure CLI. Commands are `az <group> <subgroup> <verb>`; `az <group> <verb> --help` is the authority on flags — run it instead of guessing. `az find "<what you want>"` suggests commands.

## Agent / non-interactive rules (read first)

- **Output**: add `-o json` when you need to read a value; `-o tsv` with `--query` (JMESPath) for a single value you feed forward, e.g. `az webapp show -g rg -n app --query defaultHostName -o tsv`. `-o table` only for showing the user.
- **Always `--yes` on deletes** and `--only-show-errors` on noisy commands; anything that asks "Are you sure?" otherwise hangs.
- **Extensions**: many groups (`containerapp`, `staticwebapp` parts, `spring`) are extensions. Before the first one, run
  `az config set extension.use_dynamic_install=yes_without_prompt extension.dynamic_install_allow_preview=false` so a missing extension installs instead of prompting.
- **Subscription first**: `az account show -o json` tells you which subscription every command targets. Users often have several — confirm with `az account list -o table` and switch with `az account set --subscription <id|name>` before creating anything.
- **Resource providers**: a first-time service fails with `MissingSubscriptionRegistration`. Fix: `az provider register --namespace Microsoft.App --wait` (namespace from the error).
- **Long operations**: creates can take minutes; they block until done. Add `--no-wait` only for deletes you don't need to watch. Never use `az webapp log tail` or `--follow` — they never return; use the bounded forms under Logs.
- **Credentials are only readable after the user connects Azure** in Settings → Connectors (VibeOps hides `~/.azure` from the shell until then). If a command says `Please run 'az login'`, ask the user to connect or re-check Azure there; `az login` itself needs a browser the user drives.
- **Secrets**: connection strings, keys and passwords never go in chat. Use `secretRequest` and `$SECRET_<NAME>`, or generate the value inside the command (see "Passwords the model never sees"). Never run `az ... keys list`, `list-connection-strings`, `show-connection-string` with real credentials, `keyvault secret show`, or `acr credential show` — they print secrets.

## Blast radius (VibeOps severity tags)

- `[SAFE]` — `account show/list`, every `list`, `show` (except the secret-printing ones above), `az webapp log download`, `containerapp logs show` without `--follow`, `deployment group what-if`, `bicep build`.
- `[CAUTION]` — `group create`, any `create`/`up`/`deploy`, `appsettings set`, `restart`, `scale`, `keyvault secret set`, `provider register`, firewall rule changes. Creates **cost money** — name the SKU/tier in the plan.
- `[DESTRUCTIVE]` — `group delete` (deletes **everything** in it), any `delete`, `appsettings delete`, `deployment slot swap` (shifts prod traffic), `postgres flexible-server delete`, `keyvault purge`, role assignments. Never without explicit approval.

## Identity and scope

```bash
az account show -o json                          # the auth gate: user, tenant, subscription
az account list --query "[].{name:name,id:id,default:isDefault}" -o table
az account set --subscription "<name-or-id>"
az login                                         # browser flow — VibeOps' Connect runs it
az login --tenant <tenant-id>                    # when the subscription lives in another tenant
az group list -o table
az group create -n my-app-rg -l eastus
az configure --defaults group=my-app-rg location=eastus    # then -g/-l can be dropped
```

## App Service (web apps)

```bash
az webapp list --query "[].{name:name,rg:resourceGroup,host:defaultHostName,state:state}" -o table
az webapp up --name my-app --resource-group my-app-rg --runtime "NODE:20-lts" --sku B1 --location eastus   # create+deploy from cwd
az webapp list-runtimes --os linux -o table
az webapp deploy -g my-app-rg -n my-app --src-path app.zip --type zip     # deploy a built artifact
az webapp config appsettings set -g my-app-rg -n my-app --settings NODE_ENV=production DATABASE_URL=$SECRET_DATABASE_URL -o none
az webapp config appsettings list -g my-app-rg -n my-app --query "[].name" -o tsv     # names only
az webapp restart -g my-app-rg -n my-app
az webapp browse -g my-app-rg -n my-app
```

`az webapp up` is idempotent: re-running it in the same folder redeploys to the app it wrote into `.azure/config`. Always pass `-o none` on `appsettings set` — its default output echoes every value, secrets included. Slots: `az webapp deployment slot create --slot staging`, deploy with `--slot staging`, then `az webapp deployment slot swap --slot staging` (DESTRUCTIVE: it's a prod cutover).

## Container Apps + Container Registry

```bash
az containerapp up --name my-api --resource-group my-app-rg --location eastus --source . --ingress external --target-port 8080
az containerapp list -o table
az containerapp show -g my-app-rg -n my-api --query properties.configuration.ingress.fqdn -o tsv
az containerapp update -g my-app-rg -n my-api --image myacr.azurecr.io/my-api:v2
az containerapp secret set -g my-app-rg -n my-api --secrets db-url=$SECRET_DATABASE_URL
az containerapp update -g my-app-rg -n my-api --set-env-vars DATABASE_URL=secretref:db-url
az containerapp revision list -g my-app-rg -n my-api -o table
```

`containerapp up --source .` builds in the cloud (no local Docker needed), creating registry and environment if missing. For your own registry:

```bash
az acr create -g my-app-rg -n myacr --sku Basic
az acr build -r myacr -t my-api:v2 .           # cloud build — no docker login, no platform mismatch
az acr repository list -n myacr -o table
```

## Static Web Apps

```bash
az staticwebapp list -o table
az staticwebapp create -n my-site -g my-app-rg -l eastus2 --sku Free
az staticwebapp show -n my-site --query defaultHostname -o tsv
az staticwebapp appsettings set -n my-site --setting-names API_URL=https://api.example.com
```

Uploading a built folder needs the SWA CLI and a deployment token; don't print the token — pipe it:
`npx @azure/static-web-apps-cli deploy ./dist --env production --deployment-token "$(az staticwebapp secrets list -n my-site --query properties.apiKey -o tsv)"`.

## Functions

```bash
az functionapp list -o table
az functionapp create -g my-app-rg -n my-func --storage-account mystorage --consumption-plan-location eastus --runtime node --functions-version 4 --os-type Linux
az functionapp deployment source config-zip -g my-app-rg -n my-func --src func.zip
az functionapp config appsettings set -g my-app-rg -n my-func --settings KEY=value -o none
```

If the project has Azure Functions Core Tools set up (`host.json` present, `func` on PATH), `func azure functionapp publish my-func` is the usual deploy.

## Databases: PostgreSQL flexible server

```bash
az postgres flexible-server list -o table
pw=$(openssl rand -hex 24); \
az postgres flexible-server create -g my-app-rg -n my-pg --tier Burstable --sku-name Standard_B1ms --version 16 \
  --admin-user appadmin --admin-password "$pw" --public-access None -o none && \
printf %s "$pw" | az keyvault secret set --vault-name my-kv -n pg-admin-password --file /dev/stdin -o none
az postgres flexible-server db create -g my-app-rg -s my-pg -d appdb
az postgres flexible-server firewall-rule create -g my-app-rg -n my-pg -r allow-azure --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0   # "Azure services" only
```

`-o none` on `create` matters: its output includes the connection string with the password.

## Key Vault

```bash
az keyvault create -n my-kv -g my-app-rg -l eastus
az keyvault secret set --vault-name my-kv -n DATABASE-URL --value $SECRET_DATABASE_URL -o none
az keyvault secret list --vault-name my-kv --query "[].name" -o tsv     # names only
```

Key Vault secret names allow only letters, digits and dashes (no underscores). App Service can reference them: `--settings DATABASE_URL="@Microsoft.KeyVault(SecretUri=https://my-kv.vault.azure.net/secrets/DATABASE-URL/)"` once the app has a managed identity with get access.

## Infrastructure as code

```bash
az deployment group what-if -g my-app-rg --template-file main.bicep --parameters env=prod      # preview first
az deployment group create -g my-app-rg --template-file main.bicep --parameters env=prod
az deployment group list -g my-app-rg -o table
```

If the repo has `azure.yaml`, it's an Azure Developer CLI project — `azd up` / `azd deploy` is the intended path (if `azd` is installed).

## Logs and debugging

```bash
az webapp log config -g my-app-rg -n my-app --application-logging filesystem --level information
az webapp log download -g my-app-rg -n my-app --log-file /tmp/app-logs.zip && unzip -l /tmp/app-logs.zip
az containerapp logs show -g my-app-rg -n my-api --tail 100 --follow false
az monitor activity-log list -g my-app-rg --offset 1h --query "[].{op:operationName.value,status:status.value,time:eventTimestamp}" -o table
```

## Typical flows

**Deploy a Node app to App Service:** `az account show` → `az group create` → `az webapp up --runtime "NODE:20-lts" --sku B1` → `appsettings set ... -o none` → `az webapp show --query defaultHostName -o tsv` → `curl -I https://<host>`.

**Containerized API:** `az containerapp up --source . --ingress external --target-port <port>` → `containerapp secret set` + `--set-env-vars X=secretref:x` → `containerapp logs show --tail 50 --follow false`.

## Passwords the model never sees

When a new credential must go to two places, generate it inside the command and pipe it on, printing nothing (see the PostgreSQL example): `pw=$(openssl rand -hex 24); <create with "$pw"> -o none && printf %s "$pw" | <store it>`.

## Gotchas

- Names of storage accounts, registries, key vaults and web apps are **globally unique** DNS names — add a short random suffix rather than retrying.
- Storage account names: 3–24 lowercase letters and digits only. Key Vault: 3–24 chars, letters/digits/dashes.
- `AuthorizationFailed` names the missing action and scope — report it; don't try to grant roles yourself.
- Region names are lowercase without spaces (`eastus`, `westeurope`); `az account list-locations -o table` lists them. Not every SKU exists in every region.
