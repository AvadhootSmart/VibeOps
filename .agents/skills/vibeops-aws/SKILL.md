---
name: vibeops-aws
description: Deploy and manage AWS with the `aws` CLI v2 — identity and profiles, S3 static sites, CloudFront, ECR, ECS/Fargate, Lambda, App Runner, EC2, RDS, Secrets Manager/SSM, CloudFormation and CloudWatch logs. Use for any task involving an AWS account, an AWS deploy, or inspecting AWS resources. Prefer these exact commands over guessing flags.
---

# AWS CLI (v2)

`aws` is the AWS CLI. VibeOps assumes **v2** (`aws --version` → `aws-cli/2.x`); v1 lacks `aws login`, `aws sso` and several flags below. Every service is `aws <service> <operation>`; `aws <service> <operation> help` is the authority on flags — run it instead of guessing.

## Agent / non-interactive rules (read first)

- **Disable the pager on every command**: prefix with `AWS_PAGER=""` or add `--no-cli-pager`. Without it, any output longer than a screen opens `less` and the command hangs forever (there is no local timeout).
- **Output**: add `--output json` when you need to read a value, and cut it down server-side with `--query` (JMESPath), e.g. `--query 'Reservations[].Instances[].InstanceId' --output text`. `--output text` is best for a single value you feed into the next command.
- **Region**: nearly everything is regional. Pass `--region <r>` explicitly unless `aws configure get region` returned one. A resource "not found" is very often the wrong region.
- **Profiles**: `--profile <name>` or `AWS_PROFILE=<name>`. `aws configure list-profiles` shows what exists. Never assume `default` is the account the user means — confirm with `sts get-caller-identity`.
- **No `--follow` / `wait` without a bound.** `aws logs tail --follow` never returns; use `--since 15m`. `aws ... wait` waiters give up after their own timeout, which is fine.
- **Credentials are only readable after the user connects AWS** in Settings → Connectors (VibeOps hides `~/.aws` from the shell until then). If a command reports `Unable to locate credentials` or `ExpiredToken`, ask the user to connect or re-check AWS there — do not try to read or write `~/.aws/credentials` yourself.
- **Secrets**: access keys, DB passwords and connection strings never go in chat. Use `secretRequest` and `$SECRET_<NAME>`, or generate the value inside the command and pipe it straight to its destination (see "Passwords the model never sees").

## Blast radius (VibeOps severity tags)

- `[SAFE]` — `sts get-caller-identity`, every `describe-*`, `list-*`, `get-*` (except `secretsmanager get-secret-value` / `ssm get-parameter --with-decryption`, which print secrets — never run those), `s3 ls`, `logs tail` without `--follow`, `cloudformation validate-template`, `deploy --no-execute-changeset`.
- `[CAUTION]` — creating anything (`s3 mb`, `create-*`, `run-instances`), `s3 sync` without `--delete`, `lambda update-function-code`, `ecs update-service`, `cloudfront create-invalidation`, security-group ingress changes, `put-secret-value`, `cloudformation deploy`. Most of these **cost money** — say so in the plan.
- `[DESTRUCTIVE]` — `s3 rb --force`, `s3 rm --recursive`, `s3 sync --delete`, any `delete-*`, `terminate-instances`, `ecs delete-service`, `rds delete-db-instance` (take `--final-db-snapshot-identifier` unless told otherwise), `cloudformation delete-stack`, every `iam` write (users, policies, access keys). Never without explicit approval.

## Identity and accounts

```bash
AWS_PAGER="" aws sts get-caller-identity --output json      # the auth gate: Account, Arn
aws configure list                                           # where creds/region come from
aws configure list-profiles
aws configure get region --profile <p>
aws login                    # browser sign-in with console credentials (CLI ≥ 2.32) — VibeOps' Connect runs this
aws login --profile <p>      # sign a separate profile in
aws logout [--profile <p> | --all]
aws sso login --profile <p>  # IAM Identity Center profiles (interactive; the user runs it)
```

About `aws login` sessions:
- They last up to the principal's session duration (**max 12 hours**); after that, sign-in checks fail and the user must press Connect again. Cached under `~/.aws/login/cache`.
- IAM users and roles need the `SignInLocalDevelopmentAccess` managed policy (root needs nothing). An `AccessDenied` from `signin` during login means that policy is missing.
- It refuses a profile that already has access keys, SSO, `role_arn` or `credential_process` ("Profile 'default' is already configured with Access Key credentials"). Those profiles already work: `aws sts get-caller-identity` succeeds, so the user should press **Check sign-in**, not Connect, or sign a new profile in with `--profile`.
- When no region was configured, VibeOps signs in with `--region us-east-1` and **writes no region** to `~/.aws/config`, so pass `--region` on every command (ask the user which region their resources are in, or check `aws configure get region`).

One-off keys the user supplies (via `secretRequest`), without touching `~/.aws`:

```bash
AWS_ACCESS_KEY_ID=$SECRET_AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$SECRET_AWS_SECRET_ACCESS_KEY AWS_REGION=us-east-1 \
  aws sts get-caller-identity --no-cli-pager
```

## Static sites: S3 + CloudFront

```bash
aws s3 mb s3://my-site-bucket --region us-east-1
aws s3 sync ./dist s3://my-site-bucket --delete                                   # DESTRUCTIVE (--delete removes stale files)
aws s3 cp ./dist/index.html s3://my-site-bucket/index.html --cache-control no-cache
aws cloudfront list-distributions --query 'DistributionList.Items[].{id:Id,domain:DomainName,origin:Origins.Items[0].DomainName}' --output table --no-cli-pager
aws cloudfront create-invalidation --distribution-id E123ABC --paths '/*'
```

New buckets block public access by default — keep it that way and serve through CloudFront with Origin Access Control rather than making the bucket public. Hashed assets can be cached forever; `index.html` should not be.

## Containers: ECR → ECS / App Runner

```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
aws ecr create-repository --repository-name my-app --region $REGION
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
docker build --platform linux/amd64 -t $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/my-app:latest .
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/my-app:latest
```

Build for `linux/amd64` on Apple Silicon unless the task/service runs on Graviton (`ARM64`) — an arm64 image on x86 Fargate fails with `exec format error`.

ECS (existing service, new image with the same tag):

```bash
aws ecs list-clusters --no-cli-pager
aws ecs list-services --cluster my-cluster --no-cli-pager
aws ecs update-service --cluster my-cluster --service my-svc --force-new-deployment --no-cli-pager
aws ecs wait services-stable --cluster my-cluster --services my-svc
aws ecs describe-services --cluster my-cluster --services my-svc \
  --query 'services[0].{status:status,running:runningCount,desired:desiredCount,events:events[:5].message}' --no-cli-pager
```

A new image tag needs a new task definition revision: `aws ecs describe-task-definition --task-definition my-task --query taskDefinition`, change the image, strip the read-only fields (`taskDefinitionArn`, `revision`, `status`, `requiresAttributes`, `compatibilities`, `registeredAt`, `registeredBy`), `register-task-definition --cli-input-json file://td.json`, then `update-service --task-definition my-task`.

App Runner is the simplest "run this container" option: `aws apprunner list-services`, `aws apprunner start-deployment --service-arn <arn>` for a redeploy.

## Lambda

```bash
aws lambda list-functions --query 'Functions[].{name:FunctionName,runtime:Runtime}' --output table --no-cli-pager
(cd build && zip -qr ../function.zip .)
aws lambda update-function-code --function-name my-fn --zip-file fileb://function.zip --no-cli-pager
aws lambda wait function-updated --function-name my-fn
aws lambda update-function-configuration --function-name my-fn --environment "Variables={NODE_ENV=production}"
aws lambda invoke --function-name my-fn --payload '{}' --cli-binary-format raw-in-base64-out /tmp/out.json && cat /tmp/out.json
aws lambda create-function-url-config --function-name my-fn --auth-type NONE   # CAUTION: public URL
```

`update-function-configuration --environment` **replaces** the whole variable map — read the current one first and merge. Don't put secrets in plain environment variables; reference Secrets Manager or SSM from the code.

## EC2

```bash
aws ec2 describe-instances --filters Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].{id:InstanceId,type:InstanceType,ip:PublicIpAddress,name:Tags[?Key==`Name`]|[0].Value}' --output table --no-cli-pager
aws ec2 describe-security-groups --group-ids sg-123 --no-cli-pager
aws ec2 authorize-security-group-ingress --group-id sg-123 --protocol tcp --port 443 --cidr 0.0.0.0/0   # CAUTION
aws ec2 start-instances --instance-ids i-123 / stop-instances / reboot-instances
aws ec2 terminate-instances --instance-ids i-123                                                         # DESTRUCTIVE
```

To work on the box itself, use the `sshConnect` / `sshRun` tools against its public IP or DNS; never open port 22 to `0.0.0.0/0` without saying so.

## Databases: RDS

```bash
aws rds describe-db-instances --query 'DBInstances[].{id:DBInstanceIdentifier,engine:Engine,status:DBInstanceStatus,host:Endpoint.Address,port:Endpoint.Port}' --output table --no-cli-pager
aws rds create-db-instance --db-instance-identifier my-db --engine postgres --db-instance-class db.t4g.micro \
  --allocated-storage 20 --master-username app --manage-master-user-password --no-publicly-accessible
aws rds wait db-instance-available --db-instance-identifier my-db
aws rds delete-db-instance --db-instance-identifier my-db --final-db-snapshot-identifier my-db-final    # DESTRUCTIVE
```

`--manage-master-user-password` keeps the password in Secrets Manager so it never exists on this machine. Instances are private by default; the app must be in the same VPC (or the user must explicitly accept `--publicly-accessible` plus a narrow security group).

## Secrets Manager and SSM Parameter Store

```bash
aws secretsmanager create-secret --name my-app/DATABASE_URL --secret-string $SECRET_DATABASE_URL --no-cli-pager
aws secretsmanager put-secret-value --secret-id my-app/DATABASE_URL --secret-string $SECRET_DATABASE_URL --no-cli-pager
aws secretsmanager list-secrets --query 'SecretList[].Name' --no-cli-pager
aws ssm put-parameter --name /my-app/API_KEY --type SecureString --value $SECRET_API_KEY --overwrite --no-cli-pager
aws ssm get-parameters-by-path --path /my-app --query 'Parameters[].Name' --no-cli-pager      # names only
```

Writing is fine; **reading values back is not** — never run `get-secret-value` or `--with-decryption`.

## CloudFormation / SAM / CDK

```bash
aws cloudformation validate-template --template-body file://template.yaml
aws cloudformation deploy --template-file template.yaml --stack-name my-app --capabilities CAPABILITY_IAM --no-execute-changeset   # preview
aws cloudformation deploy --template-file template.yaml --stack-name my-app --capabilities CAPABILITY_IAM
aws cloudformation describe-stack-events --stack-name my-app --query 'StackEvents[:15].[ResourceStatus,LogicalResourceId,ResourceStatusReason]' --output table --no-cli-pager
aws cloudformation describe-stacks --stack-name my-app --query 'Stacks[0].Outputs' --no-cli-pager
```

If the project already has `samconfig.toml` (SAM) or `cdk.json` (CDK), use its tool: `sam build && sam deploy --no-confirm-changeset`, `npx cdk diff` then `npx cdk deploy --require-approval never` — `cdk diff` first, and show it in the plan.

## Logs and debugging

```bash
aws logs describe-log-groups --query 'logGroups[].logGroupName' --no-cli-pager
aws logs tail /aws/lambda/my-fn --since 30m --format short
aws logs tail /ecs/my-task --since 1h --filter-pattern ERROR
aws cloudwatch describe-alarms --state-value ALARM --no-cli-pager
```

## Typical flows

**Deploy a static frontend to an existing S3 + CloudFront setup:**
```bash
AWS_PAGER="" aws sts get-caller-identity            # right account?
npm run build
aws s3 sync ./dist s3://my-site-bucket --delete      # DESTRUCTIVE — in the plan
aws cloudfront create-invalidation --distribution-id E123ABC --paths '/*'
```

**Ship a new container image to ECS:** login to ECR → `docker build --platform linux/amd64` → push → `ecs update-service --force-new-deployment` → `ecs wait services-stable` → `logs tail --since 10m` to confirm it started.

## Passwords the model never sees

When a new credential must go to two places (the database and the app's env), generate it inside the command and pipe it on, printing nothing:

```bash
pw=$(openssl rand -hex 24); \
aws secretsmanager create-secret --name my-app/DB_PASSWORD --secret-string "$pw" >/dev/null && \
printf %s "$pw" | vercel env add DB_PASSWORD production
```

## Gotchas

- `AccessDenied` names the missing action (`not authorized to perform: ecs:UpdateService`) — report that to the user; don't try to grant it via IAM yourself.
- Global services (IAM, CloudFront, Route 53) ignore `--region`; ACM certificates for CloudFront must be in `us-east-1`.
- `fileb://` for binary uploads (zips), `file://` for JSON/YAML input.
- `aws s3` (high-level: `cp`, `sync`, `ls`) and `aws s3api` (1:1 API: `put-bucket-policy`, `get-bucket-location`) are different commands with different flags.
