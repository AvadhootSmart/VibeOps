/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures are raw CLI JSON */
import { expect, test } from "bun:test";
import { handlers } from "./harness";

// Fixtures are real lines captured from each CLI. Run with `bun test`.
const fold = (agent: string, events: any[]) => {
  const sink = {
    text: "",
    reasoning: "",
    sessionId: undefined as string | undefined,
    steps: [] as any[],
    byId: new Map(),
    textParts: new Map(),
    reasonParts: new Map(),
  };
  for (const e of events) handlers[agent](e, sink);
  return sink;
};

test("cursor keeps each segment once despite the triple emit", () => {
  const sid = "b6dda6c5";
  const s = fold("cursor", [
    { type: "system", subtype: "init", session_id: sid },
    // token deltas
    { type: "assistant", message: { content: [{ type: "text", text: "Running" }] }, session_id: sid, timestamp_ms: 1 },
    { type: "assistant", message: { content: [{ type: "text", text: " now." }] }, session_id: sid, timestamp_ms: 2 },
    // the same segment flushed whole — carries model_call_id
    { type: "assistant", message: { content: [{ type: "text", text: "Running now." }] }, session_id: sid, model_call_id: "m0", timestamp_ms: 3 },
    // and repeated at the end with neither marker
    { type: "assistant", message: { content: [{ type: "text", text: "Running now." }] }, session_id: sid },
  ]);
  expect(s.text).toBe("Running now.");
  expect(s.sessionId).toBe(sid);
});

test("cursor names an MCP step after the VibeOps tool, not callMcpTool", () => {
  const args = { server: "vibeops", toolName: "getSystemInfo" };
  const s = fold("cursor", [
    { type: "tool_call", subtype: "started", call_id: "t1", tool_call: { callMcpToolToolCall: { args } } },
    {
      type: "tool_call",
      subtype: "completed",
      call_id: "t1",
      tool_call: { callMcpToolToolCall: { args, result: { success: { content: "{}" } } } },
    },
  ]);
  expect(s.steps).toHaveLength(1);
  expect(s.steps[0].toolName).toBe("getSystemInfo");
  expect(s.steps[0].state).toBe("output-available");
});

test("cursor thinking deltas accumulate as reasoning", () => {
  const s = fold("cursor", [
    { type: "thinking", subtype: "delta", text: "Calling the" },
    { type: "thinking", subtype: "delta", text: " tool." },
    { type: "thinking", subtype: "completed" },
  ]);
  expect(s.reasoning).toBe("Calling the tool.");
});

test("opencode re-joins parts rather than appending them twice", () => {
  const sid = "ses_fe04";
  const s = fold("opencode", [
    { type: "step_start", sessionID: sid, part: { id: "p0", type: "step-start" } },
    {
      type: "tool_use",
      sessionID: sid,
      part: {
        type: "tool",
        tool: "vibeops_getSystemInfo",
        callID: "c1",
        state: { status: "completed", input: {}, output: '{"os":"darwin"}' },
        id: "p1",
      },
    },
    { type: "text", sessionID: sid, part: { id: "p2", type: "text", text: "The host" } },
    // same part re-sent as it grows — must replace, not concatenate
    { type: "text", sessionID: sid, part: { id: "p2", type: "text", text: "The hostname is darwin." } },
  ]);
  expect(s.text).toBe("The hostname is darwin.");
  expect(s.sessionId).toBe(sid);
  expect(s.steps).toHaveLength(1);
  expect(s.steps[0].toolName).toBe("getSystemInfo");
  expect(s.steps[0].output).toBe('{"os":"darwin"}');
});

test("opencode marks a failed tool call as an error", () => {
  const s = fold("opencode", [
    {
      type: "tool_use",
      sessionID: "s",
      part: { type: "tool", tool: "bash", callID: "c1", state: { status: "error", input: {}, error: "exit 1" } },
    },
  ]);
  expect(s.steps[0].state).toBe("output-error");
  expect(s.steps[0].errorText).toBe("exit 1");
});

test("claude code streams deltas and pairs tool results by id", () => {
  const s = fold("claude-code", [
    { type: "system", session_id: "abc" },
    { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hi" } } },
    { type: "assistant", message: { content: [{ type: "tool_use", id: "u1", name: "mcp__vibeops__sshRun", input: { command: "ls" } }] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "u1", content: "ok" }] } },
    { type: "result", session_id: "abc", result: "Hi" },
  ]);
  expect(s.text).toBe("Hi");
  expect(s.sessionId).toBe("abc");
  expect(s.steps[0].toolName).toBe("sshRun");
  expect(s.steps[0].output).toBe("ok");
  expect(s.steps[0].state).toBe("output-available");
});
