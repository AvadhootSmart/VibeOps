# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

VibeOps is a Wails v2 desktop app (Go backend + React/Vite/TypeScript frontend) whose core is an AI agent that runs **in the frontend** and reaches the local machine through Go tool bindings.

## Commands

- `wails dev` — run the full app (Go + frontend) with hot reload; frontend dev server at http://localhost:5173. Regenerates Go→TS bindings.
- `wails build` or `./scripts/build.sh` — production build → `build/bin/`. Per platform: `./scripts/build-macos-arm.sh` (Apple Silicon, signed) and `./scripts/build-windows.sh`; `./scripts/build-all.sh` builds both. Intel Macs and Linux are not supported targets.
- Frontend-only (from `frontend/`, uses **bun**): `bun run dev`, `bun run build` (`tsc && vite build`), `bun run lint`.
- Typecheck: `cd frontend && bunx tsc --noEmit`.

- Tests: `go test ./...` and `cd frontend && bun test`. Some Go tests run real sandboxed commands, so they need the platform's sandbox (built in on macOS; bubblewrap on Linux/WSL) and skip without it.

## Architecture

**The agent runs client-side.** All LLM orchestration lives in the frontend (`frontend/src/lib/ai/`) using the Vercel AI SDK against OpenRouter. There is no chat backend/HTTP route — `runAgent` in `agent.ts` calls `streamText` and consumes `result.fullStream` directly, pushing partial snapshots via an `onUpdate` callback so the UI renders live. `stopWhen: stepCountIs(15)` is only a runaway guardrail; the loop ends naturally when the model finishes or gives up.

**Two-layer tool bridge (the central pattern).** An AI "tool" spans Go and TS:

1. Go side (`backend/tools/tools.go`): a method on the `Tool` struct (e.g. `GetSystemInfo`, `ShellAccess`). Bound in `main.go`, so Wails generates a TS namespace under `frontend/wailsjs/go/tools/`.
2. TS side (`frontend/src/lib/ai/tools/*.ts`): a `tool({...})` definition whose `execute` calls the generated binding (webview → Wails → Go) and returns the result to the model. Registered by model-facing name in `frontend/src/lib/ai/tools/index.ts`.

**One manifest, every harness.** A tool's name, description and input schema live only in `frontend/src/lib/ai/tools/manifest.json`. The AI-SDK path imports it (`tools/define.ts` builds each `tool()` from it), and Go embeds the same file (`tools_embed.go`) so `backend/mcp` serves it verbatim as `tools/list` and `harness.go` derives Claude Code's `--allowedTools` from it. Never write a description or schema anywhere else.

**Harness providers.** `backend/tools/harness.go` drives the coding-agent CLIs the user already has (`claude`, `cursor-agent`, `opencode`), one subprocess per turn, forwarding each JSON line on `harness:<runID>`; `frontend/src/lib/ai/harness.ts` folds those into the same `AgentResult` the OpenRouter path returns. Each CLI is pointed back at `vibeops mcp` a different way — Claude Code inline (`--mcp-config`), opencode via `OPENCODE_CONFIG_CONTENT`, Cursor via a throwaway `--workspace` holding `.cursor/mcp.json`, since Cursor has no inline flag and scrubs the environment of MCP children. Adding a harness is: a row in `bins`, an arg case in `Run`, a handler in `harness.ts`, an entry in `HARNESSES` (`lib/config.ts`), and a provider row under `components/custom/providers/`.

To add a capability: add the Go method → bind (if a new service struct) in `main.go` → add the entry to `manifest.json` → `defineTool("<name>", execute)` in a `tools/*.ts` file → register in `tools/index.ts` → add a `case "<name>":` to `backend/mcp/server.go`'s `callTool`. The frontend cannot run tools standalone; they require the Go runtime, so use `wails dev` rather than `vite` alone when exercising the agent.

The sudo/secrets rules the model is given live once, in `frontend/src/lib/ai/policy.md`; both system prompts include it.

**Secrets have one implementation, in Go.** `$SECRET_` substitution, output redaction and the sudo password all happen inside `Tool.ShellAccess` and `SSH.RunRemote`, reading the run-scoped keychain store in `backend/settings`. Both agent paths route through those, so neither the webview nor the MCP child holds a secret value. The frontend can only write (`SetRunSecret`) and clear (`ClearRunSecrets`) — there is deliberately no read binding.

**Every command is approved in Go.** `ShellAccess` and `RunRemote` call `approve` (`backend/tools/approval.go`) before running anything: it raises the ask dialog — directly in the app, over the loopback ask listener from the MCP child — and returns the user's refusal to the model as an error. "Run everything this turn" and a plan card's go-ahead (`ApproveNextTurn`) skip the prompt until the turn ends. The harness CLIs' own shell and write tools are switched off in `harness.go`, so they can't route around it.

**Errors are logged.** `notifyError` (`lib/notify.ts`) also appends to `error.log` through `backend/errlog`, which redacts secrets first; pass `{ source }` to tag the entry. Use `logError` for failures that shouldn't raise a toast. Go-side failures call `errlog.Write` directly.

**Settings vs tools.** `backend/settings/settings.go` is deliberately separate from tools: it's privileged local config (OpenRouter API key, model choice) stored in the **OS keychain** via go-keyring, not exposed to the model. The API key and model are read at request time in `frontend/src/lib/ai/provider.ts` through the `Settings` binding; a missing key throws `MissingApiKeyError`.

**Frontend structure.** `@/` aliases `frontend/src/`. Routing is in `routes.tsx` with pages under `src/pages/` (e.g. `assistant.tsx` drives the agent, `settings.tsx` manages the key). shadcn/ui primitives live in `src/components/ui/`; Vercel AI Elements chat components in `src/components/ai-elements/`. The public surface of the AI layer is re-exported from `src/lib/ai/index.ts` — import from `@/lib/ai`, not deep paths.

**Generated code.** Everything under `frontend/wailsjs/` is generated by Wails from the Go bindings — do not hand-edit; change the Go signatures and rebuild.

## Coding Practices & Rules:

- Do not write extensive comment blocks explaining methods,etc.
- Write code in such a manner that reading the code is self-explanatory.
- Write comments only when necessary like in cases for explaining a explicit decision made, things that are not self-explanatory, business decision reasons, etc.
- We're maintaining two ways of AI providers:

1. Through AI-sdk provider with API keys
2. Through coding harnesses (Claude Code, Cursor, opencode).

- The harnesses use VibeOps tools through the MCP server and AI-SDK uses tools through the tools registry under `src/lib/ai/tools/`.

- Every tool created should be catering both AI modes.
- Claude Code, Cursor and opencode are supported harnesses; Codex is next.

### Frontend:

- Do not create inline components. Every custom component should be modular into /src/components/custom
- Whenever a new tool is added, create a new file in /src/lib/ai/tools and register it in /src/lib/ai/tools/index.ts

> Only create a new file for the tool if the tool domain does not exist.

- Dont dump everything into the screen. Modularize it into smaller components and then stitch them into the screen file.
- When modualizing components based on screen, create them into `/src/components/custom/<screen_name>/<component_name>`
- If a component can be used and shared across screens, create it in `/src/components/custom/<component_name>`

### Backend:

- No secret should ever touch the LLM layer. i.e the model should not be able to read any secrets.
