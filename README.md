<p align="center">
  <img src="frontend/images/logo.png" alt="VibeOps" width="96" />
</p>

<h1 align="center">VibeOps</h1>

<p align="center">
  An AI ops agent for your own machine and servers — that never sees your secrets.
  <br />
  <a href="https://getvibeops.in">Download</a> ·
  <a href="#build-from-source">Build from source</a> ·
  <a href="INSTALL.md">Install notes</a>
</p>

---

VibeOps is a desktop app (macOS on Apple Silicon; Windows experimental) where
an agent inspects, deploys and fixes things on your machine and your servers.
Ask for a change, and it proposes a plan with every step tagged by blast
radius. Nothing runs until you approve it.

- **Bring your own model.** Use an OpenRouter key, or a coding agent you
  already pay for: Claude Code, opencode or Cursor. VibeOps drives it and gives
  it its own tools over MCP.
- **Secrets never reach the model.** When a command needs a password or a token,
  the model writes `$SECRET_NAME`. You type the value into a VibeOps dialog, and
  it's substituted at execution time and redacted from the output. `sudo` works
  the same way.
- **Every command asks first.** Local and SSH commands stop for your approval,
  with the exact command shown. You can allow the rest of a turn in one click,
  and approving a deployment plan approves its steps.
- **A sandboxed local shell.** The agent's shell can't read `~/.ssh`, `~/.aws`,
  `~/.kube`, cloud CLI tokens, `.npmrc`/`.netrc`, browser profiles or the
  Keychain. The kernel enforces this: seatbelt on macOS, bubblewrap inside
  WSL on Windows.
- **Deploy with connectors.** Vercel, Cloudflare, Neon, Supabase, AWS, Azure,
  Google Cloud and MongoDB Atlas, through their own CLIs, signed in as you.

## Download

Free builds for Apple Silicon Macs and Windows (experimental) are at
**[getvibeops.in](https://getvibeops.in)**. See [INSTALL.md](INSTALL.md) for
first-launch steps and Windows setup.

## Build from source

Requires Go 1.25+, [Bun](https://bun.sh) and the
[Wails CLI](https://wails.io/docs/gettingstarted/installation) v2.12+.

```bash
git clone https://github.com/AvadhootSmart/VibeOps && cd VibeOps
(cd frontend && bun install)
wails dev      # run with hot reload
wails build    # production build → build/bin/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for checks and the architecture.

## Security & privacy

- **Keys and secrets** live in the OS keychain (Keychain / Credential Manager /
  Secret Service). Nothing sensitive is written to disk in plain text.
- **What leaves your machine:**
  - your prompts and the output of the commands you approve go to the provider
    you picked (OpenRouter, or the harness CLI's vendor);
  - VibeOps itself makes one update check against `getvibeops.in/manifest`;
  - the model picker loads provider logos from `models.dev`.
- **What doesn't:** secret values, your OpenRouter key (it goes only to
  OpenRouter), and any telemetry. There is none.
- Found a vulnerability? See [SECURITY.md](SECURITY.md).

## How it works

The agent runs in the frontend (Vercel AI SDK), and reaches the machine through
Go bindings: a local shell, SSH, a secrets store and an approval gate. Harness
providers get the same tools by spawning `vibeops mcp`. One `manifest.json`
defines every tool for both paths. [CLAUDE.md](CLAUDE.md) is the architecture
guide.

## License

[FSL-1.1-MIT](LICENSE.md): use it, read it, change it, build it. You can't sell
a competing product built from it. Each release becomes MIT two years after
it ships. Bundled third-party code keeps its own license; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

All product names and logos are property of their respective owners.
