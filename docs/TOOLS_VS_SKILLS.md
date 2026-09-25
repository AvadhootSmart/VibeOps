# Tools vs Skills — a mental model

A learner doc. When do you turn a capability into a **tool**, and when do you
leave it to a **skill**? This is the single most repeated design decision in an
agentic app, and getting it wrong bloats the codebase (too many tools) or makes
the agent flaky (too few).

## The one-sentence difference

> A **tool** is code the model *calls*. A **skill** is knowledge the model
> *reads*.

Everything else follows from that. A tool is deterministic — same inputs, same
Go/TS runs, same shape back. A skill is interpretive — text instructions the
model reads and then decides what to do with, using whatever generic tools it
already has.

In VibeOps this is literal:

- **Tool** = the two-layer bridge. A Go method (`ShellAccess`, `GenerateOverview`)
  bound in `main.go`, wrapped in a TS `tool({...})`, registered in
  `tools/index.ts`. The model emits a tool-call; *your code* runs.
- **Skill** = a `SKILL.md` file under `.agents/skills/`. Its name+description sit
  in the system prompt; the model calls the generic `useSkill` tool to pull the
  full body on demand (progressive disclosure), then acts on the instructions
  using tools it already has (`shellAccess`, `sshRun`).

Note the relationship: **skills ride on top of tools.** A skill can't *do*
anything by itself — it's prose. It tells the model how to orchestrate the
generic tools. So the real question is never "tool or skill" in the abstract;
it's "does this capability need its *own* code path, or can existing tools +
instructions cover it?"

## Why the difference matters: where the intelligence lives

- A **tool** moves intelligence **into your code**. The logic runs the same
  regardless of which model is driving. You pay for it once (in code you
  maintain) and it never regresses.
- A **skill** leaves intelligence **in the model**. You pay nothing in code, but
  the outcome is only as good as the model reading it. A smart model follows a
  skill flawlessly; a cheap one skips steps, misparses output, or hallucinates.

This is the crux for a multi-model app (VibeOps runs SOTA Claude *and* cheap
OpenRouter models):

> The dumber the model you must support, the more you should wrap into tools.
> The smarter the model, the more you can leave to skills.

A frontier model with a raw shell and a good skill can do almost anything. A
7B model needs guardrails — named tools with typed inputs that remove ambiguity
and parse messy output for it.

## The decision framework

Reach for a **tool** when the capability has any of these. Reach for a **skill**
when it has none.

### 1. Determinism required
The result must be identical every run — feeding a UI, a downstream step, a
gate. `generateOverview` writes a fixed JSON shape; you can't have the model
"mostly" get the schema right. → **tool**.

### 2. Structured output the model would otherwise parse
If the model has to read an ASCII table or JSON and reshape it, do that parsing
**once in code** and hand back clean data. `vercel project ls` prints a table;
wrapping it means dumb models forward clean rows instead of botching the parse.
→ **tool**. (If the output is freeform text the model just *reads* — a log body,
a docs page — there's nothing to parse. → skill/shell.)

### 3. A decision gate
Conditional checks are where cheap models fail most: "is Vercel authed?" →
they skip it and hallucinate. A `checkConnectorAuth()` tool returns a hard
boolean. → **tool**.

### 4. Blast radius / a uniform safety contract
Anything destructive (deploy to prod, rollback, delete, write a secret) should
funnel through one code path so approval, severity tagging, and secret-handling
(value via stdin, never in the prompt) are enforced by *code*, not by hoping the
model read the rule. → **tool**, behind HITL.

### 5. Access the model can't otherwise reach
Local machine, OS keychain, a private binding. The model literally cannot do it
without a bridge. → **tool** (this is most of `backend/tools/`).

Reach for a **skill** when the capability is:

- **Knowledge / procedure**, not a new code path. "How to deploy with wrangler",
  "our nitpick review method", "the severity tags to use." The model already has
  the tools (`shellAccess`); it just needs to know *how* and *when*.
- **Broad, evolving, long-tail.** A CLI has 60 subcommands. You will not (and
  should not) wrap 60 tools. A skill teaches the whole surface in one file, and
  updates when the CLI changes without touching code.
- **Freeform in / freeform out.** No fixed schema to enforce, no parse to hoist.
- **Composition / judgment.** "First check status, then if healthy do X, else
  ask the user" — sequencing and taste live better in prose than in a rigid tool
  signature.

## The cost side (why not wrap everything)

Tools aren't free:

- **Maintenance surface.** In VibeOps every tool is ~5 touch-points (Go → bind →
  TS wrapper → register → MCP def). Sixty CLI tools = sixty things to keep in
  sync with two CLIs.
- **Prompt budget + choice paralysis.** Every tool's schema sits in context.
  Too many tools and the model picks the wrong one or stalls comparing them.
  Skills are cheap here: only name+description are always-loaded; the body is
  fetched on demand.
- **Rigidity.** A tool does exactly what its signature allows. The moment a task
  needs a flag you didn't expose, the tool is a wall. A skill + generic shell
  bends to anything.

So the null hypothesis is: **can existing generic tools + a skill do this?** If
yes, write the skill. Only promote to a dedicated tool when one of the five
triggers above forces it.

## How they compose (the healthy pattern)

Tools and skills aren't rivals — they layer:

- **Tools = verbs the model can execute** (deterministic primitives: run, list,
  deploy, read state).
- **Skills = the playbook for using those verbs** (when, in what order, with
  what caution, for a given domain).

Best-practice shape for VibeOps connectors: a *small* set of typed tools for
state + gated actions (`listConnectorApps`, `deployApp`), plus a skill that
teaches the operational judgment (preview before prod, how to read a failed
build, severity tags). The tool guarantees the dangerous step is safe; the skill
guides the model to the right step. Neither alone is enough.

## Priority / order of reach

When adding a capability, climb this ladder and stop at the first rung that holds:

1. **Do existing tools already cover it?** (e.g. `shellAccess` can run the
   command.) → just write a **skill** with the how/when. Cheapest.
2. **Is it knowledge, procedure, or long-tail CLI surface?** → **skill**.
3. **Does it hit a trigger** (determinism, parse, gate, blast radius, private
   access)? → **tool**. Prefer one connector-agnostic tool over per-CLI clones.
4. **Both?** (dangerous *and* needs judgment) → **tool for the action, skill for
   the playbook.** Common for deploy/rollback.

## Cheat sheet

| Signal | Lean tool | Lean skill |
|---|---|---|
| Output feeds UI / next step (fixed schema) | ✅ | |
| Model would parse a table/JSON into a shape | ✅ | |
| Conditional/auth gate cheap models flub | ✅ | |
| Destructive / needs approval + secret handling | ✅ | |
| Needs local/keychain/private access | ✅ | |
| Freeform text in, freeform text out | | ✅ |
| Broad, evolving, 20+ subcommand surface | | ✅ |
| "How / when / in what order" knowledge | | ✅ |
| One-off or rarely used | | ✅ |
| You must support weak models on this path | ✅ | |
| Only smart models use this path | | ✅ |

## TL;DR

- Tool = code the model calls (deterministic, you maintain it, model-independent).
- Skill = knowledge the model reads (flexible, free, only as good as the model).
- Wrap a tool for: determinism, parsing, gates, blast radius, private access.
- Write a skill for: knowledge, procedure, long-tail surface, judgment.
- Default to skill; promote to tool only when a trigger forces it.
- The weaker the models you support, the more you wrap. The smarter, the less.
- They compose: tools are the verbs, skills are the playbook.
