import { memo } from "react";
import type { AgentResult } from "@/lib/ai";
import type { Provider } from "@/lib/config";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@/components/ai-elements/task";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ProvidersCard } from "@/components/custom/deployment/providers-card";
import { PlanCard } from "@/components/custom/deployment/plan-card";

// One rendered exchange: the user's message and the agent's streamed reply.
export interface Turn {
  /** Stable across re-renders and reloads, so the transcript keys by identity
   * rather than by position. Minted on creation (use-chat-session). */
  id: string;
  prompt: string;
  result: AgentResult | null;
  // Handed over from another screen (the deployment dialog): the model gets
  // it, the user never sees it — they asked for a deployment, not a prompt.
  hidden?: boolean;
  // Which AI provider ran this turn. A harness keeps the conversation inside
  // its own CLI session, so a chat started on one can only be continued there;
  // the composer reads the first turn's value to enforce that. Absent on turns
  // saved before this was recorded, which stay unlocked.
  provider?: Provider;
  // Sidebar name for the session, set on the first turn when the screen that
  // handed the prompt over knows a better one than the prompt itself (the
  // deployment dialog names the chat after the project). Lives on the turn
  // because that is what gets persisted and reloaded.
  title?: string;
}

const plural = (n: number) => `${n} tool call${n > 1 ? "s" : ""}`;

// Tools whose whole job is to be rendered. They are pulled out of the generic
// tool list so the card is the only place their arguments show up.
const CARD_TOOLS = ["proposeProviders", "proposePlan"];

// Memoised because a stream update rebuilds the transcript array while leaving
// every finished turn's object identity alone — only the turn being written to
// needs to re-render, and re-rendering the rest is what made a long chat crawl.
export const TurnView = memo(function TurnView({
  turn,
  streaming,
  showToolCalls,
  onApprove,
}: {
  turn: Turn;
  // This is the turn currently being generated, so its parts are still growing.
  streaming: boolean;
  showToolCalls: boolean;
  // Sends a message back into the chat on the user's behalf — the plan card's
  // go-ahead button. Only passed for the turn still at the bottom of the
  // transcript; approving a plan further up would run a superseded one.
  onApprove?: (message: string) => void;
}) {
  const steps = turn.result?.steps ?? [];
  const cards = steps.filter((s) => CARD_TOOLS.includes(s.toolName));
  const toolCalls = steps.filter((s) => !CARD_TOOLS.includes(s.toolName));

  return (
    <div className="space-y-4">
      {!turn.hidden && (
        <Message from="user">
          <MessageContent>
            <MessageResponse>{turn.prompt}</MessageResponse>
          </MessageContent>
        </Message>
      )}

      {/* No answer text yet. Without this the pane is blank until the first
          delta — and a hidden handoff has no user bubble to fill the gap
          either. Tool calls can be switched off, so their absence isn't a
          signal. */}
      {streaming && !turn.result?.text && (
        <Message from="assistant">
          <MessageContent>
            <Shimmer duration={1}>
              {turn.result?.steps.length
                ? `Working… (${plural(turn.result.steps.length)})`
                : "Working…"}
            </Shimmer>
          </MessageContent>
        </Message>
      )}

      {turn.result && (
        <Message from="assistant">
          <MessageContent>
            {turn.result.reasoning && (
              <Reasoning className="w-full" isStreaming={streaming}>
                <ReasoningTrigger />
                <ReasoningContent>{turn.result.reasoning}</ReasoningContent>
              </Reasoning>
            )}

            {showToolCalls && toolCalls.length > 0 && (
              <Task defaultOpen>
                <TaskTrigger title={`Ran ${plural(toolCalls.length)} into Go`} />
                <TaskContent>
                  {toolCalls.map((s) => (
                    <TaskItem key={s.id}>
                      <Tool className="w-full" defaultOpen={false}>
                        <ToolHeader
                          type={`tool-${s.toolName}`}
                          state={s.state}
                        />
                        <ToolContent>
                          <ToolInput input={s.input} />
                          <ToolOutput
                            output={s.output}
                            errorText={s.errorText}
                          />
                        </ToolContent>
                      </Tool>
                    </TaskItem>
                  ))}
                </TaskContent>
              </Task>
            )}

            {turn.result.text && (
              <MessageResponse>{turn.result.text}</MessageResponse>
            )}

            {cards.map((s) =>
              s.toolName === "proposePlan" ? (
                <PlanCard key={s.id} input={s.input} onApprove={onApprove} />
              ) : (
                <ProvidersCard key={s.id} input={s.input} onApprove={onApprove} />
              ),
            )}
          </MessageContent>
        </Message>
      )}
    </div>
  );
});
