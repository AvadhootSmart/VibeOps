import type { ModelMessage } from "ai";
import { Run } from "@wails/go/tools/Harness";
import { Cancel } from "@wails/go/tools/Tool";
import { EventsOn } from "@wails/runtime/runtime";
import type { AgentResult, AgentStep } from "./agent";
import type { Provider } from "@/lib/config";

// Runs one turn through a local coding-agent CLI (Claude Code, Cursor,
// opencode) instead of the OpenRouter/AI-SDK provider. Go spawns the CLI in its
// JSON-event mode and forwards each line on "harness:<runId>"; the per-CLI
// handlers below fold those into the same AgentResult the OpenRouter path
// produces, so the Assistant UI renders every provider identically.
//
// Conversation continuity uses each CLI's own resume flag: we pass only the new
// user message plus the prior session id (threaded via
// AgentResult.harnessSessionId), never the whole history. That is also why
// there is one handler per CLI and not one parser — the transports agree on
// nothing but being newline-delimited JSON.

// Sink is the turn being assembled. Handlers mutate it; runHarness snapshots it.
interface Sink {
  text: string;
  reasoning: string;
  sessionId?: string;
  steps: AgentStep[];
  byId: Map<string, AgentStep>;
  /** Text/reasoning keyed by the CLI's part id, for the CLIs that re-send a
   * whole part as it grows rather than emitting deltas. */
  textParts: Map<string, string>;
  reasonParts: Map<string, string>;
}

// Each CLI's event lines are its own undocumented JSON; the handlers narrow them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (event: any, sink: Sink) => void;

function step(sink: Sink, id: string, toolName: string): AgentStep {
  let s = sink.byId.get(id);
  if (!s) {
    s = { id, toolName, input: undefined, output: undefined, state: "input-available" };
    sink.byId.set(id, s);
    sink.steps.push(s);
  }
  return s;
}

// Claude Code — `--output-format stream-json --include-partial-messages`.
const handleClaude: Handler = (e, sink) => {
  switch (e?.type) {
    case "system":
      if (e.session_id) sink.sessionId = e.session_id;
      break;
    case "stream_event": {
      // Per-token deltas — this is what makes text/thinking stream live
      // instead of arriving in one block.
      const ev = e.event;
      // A turn emits one text block per stretch between tool calls. Without a
      // break here the last sentence of one runs into the first of the next.
      if (
        ev?.type === "content_block_start" &&
        ev.content_block?.type === "text" &&
        sink.text
      ) {
        sink.text += "\n\n";
      }
      if (ev?.type === "content_block_delta") {
        if (ev.delta?.type === "text_delta") sink.text += ev.delta.text;
        else if (ev.delta?.type === "thinking_delta")
          sink.reasoning += ev.delta.thinking ?? "";
      }
      break;
    }
    case "assistant":
      // Text/thinking already streamed via stream_event deltas above; only
      // pick up tool calls here (their inputs arrive complete on this frame).
      for (const block of e.message?.content ?? []) {
        if (block.type === "tool_use") {
          const s = step(
            sink,
            block.id,
            block.name.replace(/^mcp__vibeops__/, ""),
          );
          s.input = block.input;
        }
      }
      break;
    case "user":
      for (const block of e.message?.content ?? []) {
        if (block.type === "tool_result") {
          const s = sink.byId.get(block.tool_use_id);
          if (s) {
            s.output =
              typeof block.content === "string"
                ? block.content
                : JSON.stringify(block.content);
            s.state = block.is_error ? "output-error" : "output-available";
            if (block.is_error) s.errorText = String(s.output);
          }
        }
      }
      break;
    case "result":
      if (e.session_id) sink.sessionId = e.session_id;
      // e.result is only the LAST assistant message, not the whole turn —
      // assigning it drops everything the model said before a tool call.
      // The deltas already have the full text; this is just a fallback for
      // when partial-message streaming produced nothing.
      if (!sink.text && typeof e.result === "string") sink.text = e.result;
      break;
  }
};

// Cursor — `--output-format stream-json --stream-partial-output`.
const handleCursor: Handler = (e, sink) => {
  if (e?.session_id) sink.sessionId = e.session_id;
  switch (e?.type) {
    case "thinking":
      if (e.subtype === "delta") sink.reasoning += e.text ?? "";
      break;
    case "assistant": {
      // Each segment arrives three times: once per token as a delta
      // (timestamp_ms, no model_call_id), then flushed whole with a
      // model_call_id, then repeated at the end with neither. Taking only the
      // deltas is what stops the reply appearing three times over.
      if (!e.timestamp_ms || e.model_call_id) break;
      for (const block of e.message?.content ?? []) {
        if (block.type === "text") sink.text += block.text ?? "";
      }
      break;
    }
    case "tool_call": {
      // The call is wrapped in a single key naming its kind
      // ("shellToolCall", "callMcpToolToolCall", …) rather than a name field.
      const call = e.tool_call ?? {};
      const kind = Object.keys(call).find((k) => k.endsWith("ToolCall"));
      if (!kind) break;
      const body = call[kind] ?? {};
      // An MCP call carries the VibeOps tool it is really invoking; showing
      // "callMcpTool" for all of them would make every step look the same.
      const s = step(
        sink,
        e.call_id,
        body.args?.toolName ?? kind.replace(/ToolCall$/, ""),
      );
      s.input = body.args;
      if (e.subtype === "completed") {
        const result = body.result ?? {};
        s.output = result.success ?? result;
        s.state = result.success === undefined ? "output-error" : "output-available";
        if (s.state === "output-error") s.errorText = JSON.stringify(result);
      }
      break;
    }
    case "result":
      if (!sink.text && typeof e.result === "string") sink.text = e.result;
      break;
  }
};

// opencode — `run --format json`. Events wrap a `part` that is re-sent whole as
// it grows, so text is indexed by part id and re-joined rather than appended.
const handleOpencode: Handler = (e, sink) => {
  if (e?.sessionID) sink.sessionId = e.sessionID;
  const part = e?.part;
  if (!part) return;
  switch (e.type) {
    case "text":
      sink.textParts.set(part.id, part.text ?? "");
      sink.text = [...sink.textParts.values()].join("\n\n");
      break;
    case "reasoning":
      sink.reasonParts.set(part.id, part.text ?? "");
      sink.reasoning = [...sink.reasonParts.values()].join("\n\n");
      break;
    case "tool_use": {
      const state = part.state ?? {};
      // opencode namespaces MCP tools as <server>_<tool>.
      const s = step(
        sink,
        part.callID,
        String(part.tool ?? "").replace(/^vibeops_/, ""),
      );
      s.input = state.input;
      if (state.status === "completed") {
        s.output = state.output;
        s.state = "output-available";
      } else if (state.status === "error") {
        s.state = "output-error";
        s.errorText = String(state.error ?? "unknown error");
      }
      break;
    }
  }
};

/** Exported for harness.test.ts, which replays recorded CLI output through
 * them — the folding rules (Cursor's triple-emitted segments, opencode's
 * re-sent parts) are the part that silently duplicates or drops a reply. */
export const handlers: Record<string, Handler> = {
  "claude-code": handleClaude,
  cursor: handleCursor,
  opencode: handleOpencode,
};

export async function runHarness(
  agent: Exclude<Provider, "openrouter">,
  messages: ModelMessage[],
  resumeSessionId: string | undefined,
  onUpdate?: (partial: AgentResult) => void,
  signal?: AbortSignal,
): Promise<AgentResult> {
  const lastUser = messages[messages.length - 1];
  const prompt =
    typeof lastUser?.content === "string"
      ? lastUser.content
      : // Non-string content (tool parts etc.) shouldn't reach the CLI path,
        // but stringify defensively rather than sending "[object Object]".
        JSON.stringify(lastUser?.content ?? "");

  const runId = crypto.randomUUID();
  signal?.addEventListener("abort", () => Cancel(runId));

  const sink: Sink = {
    text: "",
    reasoning: "",
    sessionId: resumeSessionId,
    steps: [],
    byId: new Map(),
    textParts: new Map(),
    reasonParts: new Map(),
  };

  const snapshot = (final = false): AgentResult => ({
    text: sink.text,
    reasoning: sink.reasoning,
    steps: sink.steps.map((s) => ({ ...s })),
    // Only pin the assistant reply into history on the final snapshot; the
    // resume id is what actually carries context to the next turn.
    messages: final
      ? [...messages, { role: "assistant", content: sink.text }]
      : messages,
    harnessSessionId: sink.sessionId,
  });

  const handle = handlers[agent];
  const off = EventsOn(`harness:${runId}`, (line: string) => {
    try {
      handle(JSON.parse(line), sink);
    } catch {
      return; // ignore non-JSON / partial lines
    }
    onUpdate?.(snapshot());
  });

  try {
    await Run(agent, prompt, resumeSessionId ?? "", runId);
  } catch (e) {
    // Aborts surface as a CLI error; if the user stopped, return what streamed.
    if (signal?.aborted) return snapshot();
    throw e;
  } finally {
    off();
  }
  return snapshot(true);
}
