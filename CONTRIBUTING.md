# Contributing

Thanks for looking. VibeOps is maintained by one person, so the rules are
simple:

- **Issues are welcome**: bugs, rough edges, ideas.
- **Pull requests by prior discussion only.** Open an issue first and wait for a
  go-ahead; unsolicited PRs may be closed without review. That's about time,
  not about you.
- No roadmap promises, no support SLA.

## Setup

Requires Go 1.25+, [Bun](https://bun.sh) and the
[Wails CLI](https://wails.io/docs/gettingstarted/installation) v2.12+.

```bash
(cd frontend && bun install)
wails dev
```

Tools run through the Go runtime, so use `wails dev`, not `vite` alone, when
exercising the agent. On Windows the agent's shell runs inside WSL and needs
bubblewrap there; see [INSTALL.md](INSTALL.md).

## Checks

Run all of these before asking for review:

```bash
go vet ./... && go test ./...
cd frontend && bunx tsc --noEmit && bun test && bun run lint
```

## Architecture

[CLAUDE.md](CLAUDE.md) is the map: how a tool spans Go and TypeScript, the
single `manifest.json` both agent paths share, how harness CLIs are driven, and
where secrets are allowed to live. Two rules matter most:

- **Every tool works in both agent modes**: the AI-SDK path and the MCP server
  the harnesses use.
- **No secret value ever reaches the model** or the webview. Substitution and
  redaction happen only in Go, in `Tool.ShellAccess` and `SSH.RunRemote`.

Everything under `frontend/wailsjs/` is generated; change the Go signature and
run `wails generate module` instead of editing it.
