import { streamText, stepCountIs, type ModelMessage } from "ai";
import POLICY from "./policy.md?raw";
import { createModel } from "./provider";
import { tools } from "./tools";
import { runHarness } from "./harness";
import { clearSecrets } from "./secrets";
import { Catalog } from "@wails/go/skills/Skills";
import { getConfig } from "@/lib/config";

// The HITL contract. The agent must NOT run remote mutations without approval;
// it proposes a plan, tags each step's blast radius, and waits for the user's
// go-ahead. Read-only inspection (status, cat, ls, df) runs freely — gating it
// would just make the agent useless. Approval lives in the chat: the user's
// next message is the gate, which is why runAgent is conversational.
//
// The sudo and secrets rules are NOT written here: policy.md holds them, and
// the harness paths append the same file (backend/tools/harness.go).
// They were maintained separately and had already contradicted each other on
// whether the model should write `sudo -S`.
const SYSTEM_PROMPT = `You are VibeOps, an ops agent that manages remote servers over SSH.

When the user asks you to CHANGE anything on a remote server (deploy, restart,
install, edit files, delete, migrate, chmod, etc.), do NOT run it yet. First
reply with an execution plan and STOP:

- One short plain-language sentence of what the plan does overall.
- A numbered list of the exact commands you will run, each prefixed with a
  severity tag and a brief note on what it does / why it matters:
    [SAFE]        read-only or trivially reversible (status checks, backups)
    [CAUTION]     changes state but recoverable (config edits, service reloads)
    [DESTRUCTIVE] data loss, downtime, or hard to undo (rm, drop, restart, force)
- End with: "Reply 'go' to run this, or tell me what to change."

Then wait. Only AFTER the user approves ('go', 'yes', 'run it', etc.) do you
call sshConnect / sshRun to execute the steps in order. If the user asks for
changes, revise the plan and wait for approval again — never run an unapproved
or edited plan.

Read-only inspection the user asked for (checking status, logs, disk, config)
does NOT need a plan — just run it and report.

${POLICY}`;

// Appends the skill catalog (names + descriptions only) to the base prompt.
// The model reads a description, then calls useSkill to pull the full body on
// demand — progressive disclosure, same as Claude Code's own skills. Built in
// Go, which appends the same text to the harness prompts.
async function buildSystemPrompt(): Promise<string> {
  const catalog = await Catalog();
  return catalog ? `${SYSTEM_PROMPT}\n\n${catalog}` : SYSTEM_PROMPT;
}

export type StepState = "input-available" | "output-available" | "output-error";

export interface AgentStep {
  /** The model's own tool-call id. Stable across re-renders, so the UI can key
   * a transcript row by it instead of by list position. */
  id: string;
  toolName: string;
  input: unknown;
  output: unknown;
  state: StepState;
  errorText?: string;
}

export interface AgentResult {
  text: string;
  reasoning: string;
  steps: AgentStep[];
  /** Full conversation (input + this turn's reply) to pass back into the next
   * runAgent call. This is what makes approval work: the plan proposed last
   * turn is still in context when the user replies "go". */
  messages: ModelMessage[];
  /** The CLI's own session id, when a harness provider ran this turn. Pass it
   * back as the next call's prevHarnessSessionId to continue that session.
   * Undefined for the OpenRouter provider (history lives in `messages`). */
  harnessSessionId?: string;
}

/**
 * Runs one agent turn over the conversation so far, streaming partial results.
 * Pass the previous result's `messages` (plus the new user turn) back in to
 * continue — the history is what lets the user approve a plan the agent
 * proposed on an earlier turn. `onUpdate` fires on every chunk so the UI can
 * render live; the returned promise resolves with the final snapshot.
 */
export async function runAgent(
  messages: ModelMessage[],
  onUpdate?: (partial: AgentResult) => void,
  signal?: AbortSignal,
  prevHarnessSessionId?: string,
): Promise<AgentResult> {
  // Provider toggle (Settings): route to a local coding-agent CLI harness, or
  // fall through to the OpenRouter/AI-SDK path below.
  const { provider } = await getConfig();
  if (provider !== "openrouter") {
    return runHarness(provider, messages, prevHarnessSessionId, onUpdate, signal);
  }

  // Start each turn with no secrets held: the model must call sudoAuth /
  // secretRequest again, so it can't inherit a prior turn's authentication.
  // Awaited — the store is shared with Go, so a tool call must not race it.
  await clearSecrets();

  const result = streamText({
    model: await createModel(),
    system: await buildSystemPrompt(),
    tools,
    // streamText ends the loop when the task is complete (final answer, no tool
    // call) or failed (the model gives up). The step cap is only a
    // developmental guardrail against runaway tool loops.
    stopWhen: stepCountIs(15),
    abortSignal: signal,
    messages,
  });

  let text = "";
  let reasoning = "";
  const steps: AgentStep[] = [];
  const byId = new Map<string, AgentStep>();

  const snapshot = (extra?: ModelMessage[]): AgentResult => ({
    text,
    reasoning,
    steps: steps.map((s) => ({ ...s })),
    messages: extra ? [...messages, ...extra] : messages,
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "abort":
        // User hit stop. Return what streamed so far; drop the reply from
        // history so a half-finished turn isn't fed back into the next call.
        return snapshot();
      case "text-delta":
        text += part.text;
        break;
      case "reasoning-delta":
        reasoning += part.text;
        break;
      case "tool-call": {
        const step: AgentStep = {
          id: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
          output: undefined,
          state: "input-available",
        };
        byId.set(part.toolCallId, step);
        steps.push(step);
        break;
      }
      case "tool-result": {
        const step = byId.get(part.toolCallId);
        if (step) {
          step.output = part.output;
          step.state = "output-available";
        }
        break;
      }
      case "tool-error": {
        const step = byId.get(part.toolCallId);
        if (step) {
          step.state = "output-error";
          step.errorText = String(part.error);
        }
        break;
      }
      case "error":
        throw part.error;
      default:
        continue;
    }
    onUpdate?.(snapshot());
  }

  // Append the assistant/tool messages this turn produced so the caller can
  // feed the whole history back in for the approval (or next) turn.
  const { messages: replyMessages } = await result.response;
  return snapshot(replyMessages);
}
