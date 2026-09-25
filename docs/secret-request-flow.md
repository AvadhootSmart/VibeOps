# Secret bridge — how it works and why

VibeOps' agent regularly needs values it must never be allowed to *see*: the
user's sudo password, an API token, a database connection string, a `.env`
value. LLM traffic is observable — prompts, tool calls, tool results and
reasoning all persist somewhere — so a secret that enters the model's context
has effectively been published.

The rule: **a secret goes from the user's keyboard to the process that runs the
command, and never through the model.** This doc is how that's enforced.

## The two halves

Protecting the inbound direction alone is theater, because secrets leak
outbound too — a deploy that prints a connection string, a `wrangler secret put`
that echoes a confirmation, a stray `cat .env`. So there are two mechanisms:

| Direction | Mechanism | Where |
|-----------|-----------|-------|
| user → command | `$SECRET_<NAME>` placeholders substituted at execution time | `settings.InjectSecrets` |
| command → model | held values scrubbed out of tool output | `settings.Redact` |

The model asks for a secret by name, is told only *that it now exists*, and
writes `$SECRET_NAME` wherever the value belongs:

```
wrangler secret put DATABASE_URL --text $SECRET_DATABASE_URL
```

The substitution happens inside `sshRun` / `shellAccess`, after the model is
done with the string. Values are **single-quoted** on the way in, so one
containing spaces, `$`, or quotes can neither break the command nor inject into
it — which is why the model is instructed never to quote the placeholder
itself. An unknown name is left untouched rather than becoming an empty string,
so the mistake surfaces as the command's own error.

`sudo` is just the reserved secret name `sudo`. It's the one value that isn't
substituted into the command text — it's fed to `sudo -S` over stdin instead —
but it's stored, prompted for, and cleared by exactly the same machinery.

## Why it needs a bridge at all

On the **OpenRouter** path the tools run *inside the frontend*, so a tool can
pop a dialog directly and stash the value in module memory
(`frontend/src/lib/ai/secrets.ts`). Easy.

The **harness** paths (Claude Code, Cursor, opencode) are harder. The process
tree is:

```
VibeOps app ──spawns──> the agent CLI ──spawns──> `vibeops mcp`  (backend/mcp)
```

The nonce reaches the child in that CLI's MCP server definition rather than by
inheritance: Cursor spawns MCP servers with a scrubbed environment, so a nonce
set only on `cursor-agent` never arrives and every request is rejected.

A tool call lands in the **`vibeops mcp` child process**, which shares no memory
with the frontend and has no handle to the dialog. So it can neither prompt the
user nor be handed the value directly. Two channels bridge the gap — both are
things the two processes already share, since they're the **same binary**:

| Direction | Channel | Carries |
|-----------|---------|---------|
| child → app | a `secret-request.json` file the app watches | "prompt the user" + name + reason |
| app → child | the OS keychain | the value |

Neither is a cross-process call — just shared disk and shared keychain.

## The flow

```
model                    vibeops mcp (child)            app (Go + frontend)
  │                            │                                │
  │ secretRequest(name,why) ─► │                                │
  │                            │ write secret-request.json ───► │ watcher (250ms poll)
  │                            │ {nonce, name, reason}          │ nonce matches
  │                            │                                │ emit "secret:request" ─► dialog
  │                            │ poll keychain …                │
  │                            │                                │ user types value
  │                            │                                │ ResolveSecret(name, v):
  │                            │                                │   keychain.Set(name→v)
  │                            │                                │   delete request file
  │                            │ keychain has it ◄──────────────│
  │ ◄─ "provided; use ────────│                                │
  │     $SECRET_NAME"          │                                │
  │                            │                                │
  │ sshRun(… $SECRET_NAME) ──► │ InjectSecrets(cmd)             │
  │                            │ RunRemote(…)                   │
  │ ◄─ Redact(output) ────────│                                │
```

All secrets live in **one keychain item** as a JSON map, so `ClearSecrets` is a
single delete that is complete even after a crash — there's no separate index of
names that could outlive the values.

## Why it's not spoofable

Any local process could drop a `secret-request.json` to try to pop the dialog
(phishing) — so:

1. **Active-run gate.** The watcher only runs while a `claude` run is in
   flight. No run → the file is ignored, no dialog.
2. **Per-run nonce.** `Run` generates a random nonce and passes it to the child
   via the `VIBEOPS_RUN_NONCE` env var (inherited through `claude`). The child
   writes it into the request file; the watcher ignores files whose nonce
   doesn't match. A foreign process doesn't know the live nonce.
3. **File perms.** The file is `0600` inside the `0700` config dir, so another
   user can't write it.
4. **Keychain item lifetime.** Even if a dialog were forced and the user typed a
   value, it is cleared at the end of the run (see below), so the window is one
   run wide.

   This item is **not** ACL-bound to VibeOps, despite what you'd expect from a
   keychain. go-keyring shells out to `/usr/bin/security`
   (`keyring_darwin.go:29`), so the ACL trusts *that binary* — any process
   running as the user reads the item silently, no prompt:

   ```
   security find-generic-password -s VibeOps -a openrouter-api-key -w   # exit 0
   ```

   Binding to the app identity needs a Go-native Security.framework call
   (`keybase/go-keychain`) instead of the `security` CLI. Until then the keychain
   here buys encryption at rest and nothing against same-uid code.
5. **Name validation.** A requested name must match `[A-Za-z0-9_]+`, so it can
   round-trip through a `$SECRET_<NAME>` placeholder and can't smuggle shell
   syntax into the substitution.

Residual boundary: a **same-uid** attacker who can read `claude`'s environment
(`/proc`, `ps -E`) could learn the nonce. That user already owns the session
(read your files, ptrace your processes), so it's not a new hole.

## Lifetime — secrets never persist

A secret is a handoff buffer, not stored config. Cleared on two guaranteed
paths:

1. **Per run (guaranteed):** `ClaudeCode.Run` does `defer settings.ClearSecrets()`,
   which fires on every exit — normal finish, error, or user cancel. So a value
   lives at most one run. (The OpenRouter path does the same with
   `clearSecrets()` at the top of every `runAgent` turn.)
2. **On startup (guaranteed):** `app.startup` clears. Startup *always* runs; a
   shutdown handler may not (`kill -9`, power loss). So a crash that skipped (1)
   still leaves nothing at next boot.

Because of (1), auth is **once per run** (one user turn), not once per app
session. If a later turn needs the same secret, the model requests it again.
Cross-run persistence was deliberately not built — it would mean secrets sitting
on disk between runs.

## Files

| File | Role |
|------|------|
| `backend/settings/settings.go` | secret store (package funcs, **not** bound to the webview), `InjectSecrets`, `Redact`, `SecretRequestPath` |
| `backend/settings/secrets_test.go` | quoting + redaction checks, incl. a real shell injection attempt |
| `backend/tools/secretbridge.go` | app-side watcher, nonce, `Harness.ResolveSecret` |
| `backend/tools/harness.go` | starts the watcher, passes the nonce into each CLI's MCP config, per-run clear, allowed tools + system prompt |
| `backend/mcp/server.go` | `sudoAuth` / `secretRequest` tools, injection + redaction in `sshRun` / `shellAccess` |
| `frontend/src/lib/ai/secrets.ts` | OpenRouter-path equivalent (in-memory, same API) |
| `frontend/src/lib/ai/tools/secrets.ts` | the two tool definitions |
| `frontend/src/components/custom/secret-dialog.tsx` | the prompt, for both paths |

## Ambient secrets — the other half

Everything above covers secrets VibeOps *holds*. It says nothing about secrets
already sitting on the machine, which the model can simply go read:
`cat ~/.ssh/id_ed25519`, `security find-generic-password`, `~/.aws/credentials`.
Injection and redaction can't help — they only know values in the stash.

Filtering the command string for those is theater: `base64`, `xxd`, `dd`,
`python -c` and `ssh-keygen -y -f` all walk around any denylist. So the shell is
constrained instead of inspected. `Tool.ShellAccess` runs `sh -c` under a macOS
seatbelt profile (`backend/tools/sandbox.go`) that denies reads of `~/.ssh`,
`~/.aws`, `~/.gnupg` and `~/Library/Keychains`, plus mach-lookup of securityd.
It's kernel-enforced, so the encoding tricks fail exactly like `cat` does —
`backend/tools/sandbox_test.go` runs three of them against the real tool method.

Both agent paths route through `Tool.ShellAccess` (the MCP child's
`shellAccess` calls it too, `backend/mcp/server.go:204`), so that one method is
the whole chokepoint.

What this deliberately does **not** cover:

- **SSH key auth still works.** Keys are read in-process by `ssh.go`, never
  through the sandboxed shell. Something that genuinely needs the key *from the
  shell* — `git push` over SSH without an agent — breaks. That's the price.
- **Remote hosts.** `RunRemote` executes on someone else's kernel; the remote
  box's `~/.ssh` and `.env` are readable. Guardrails there are the server's job.
- **`.env` files.** Too many, too load-bearing to blanket-deny by path.
- **Windows.** The shell runs inside WSL under bubblewrap, which blanks the
  same credential paths in both the Linux home and the Windows home mounted at
  `/mnt/c`.

## Known ceilings

- The child↔app bridge is a **250ms poll** on one file, not `fsnotify` — fine
  for a single file and no new dependency. A request blocks up to 120s waiting
  for the user, then times out.
- `Redact` is a plain substring scan, and **skips values under 4 characters** so
  a short one can't shred unrelated output. A 3-character secret is not
  redacted.
- Redaction covers tool *output*. It does not cover a secret the user
  voluntarily types into the chat — nothing can.
