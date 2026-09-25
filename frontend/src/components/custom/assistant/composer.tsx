import { forwardRef, useImperativeHandle, useState } from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { ProviderChip } from "@/components/custom/assistant/provider-chip";
import type { Provider } from "@/lib/config";
import { AI_PROVIDERS } from "@/lib/constants";

export interface ComposerHandle {
  /** Drops text into the draft — the blank-chat openers. */
  fill: (text: string) => void;
}

/**
 * The chat composer, which owns its own draft text.
 *
 * That ownership is the point: while the draft lived on the Assistant page,
 * every keystroke re-rendered the whole transcript, and typing into a long
 * chat — especially one the agent was still streaming into — lagged badly.
 */
export const Composer = forwardRef<
  ComposerHandle,
  {
    provider: Provider | null;
    /** Set when the chat belongs to another provider and can't be continued here. */
    lockedTo: Provider | null;
    isLoading: boolean;
    onSubmit: (text: string) => void;
    onStop: () => void;
  }
>(function Composer({ provider, lockedTo, isLoading, onSubmit, onStop }, ref) {
  const [text, setText] = useState("");
  useImperativeHandle(ref, () => ({ fill: setText }), []);

  const lockedLabel = lockedTo ? AI_PROVIDERS[lockedTo].label : null;

  function submit() {
    const input = text.trim();
    if (!input || lockedLabel) return;
    setText("");
    onSubmit(input);
  }

  return (
    <div className="mt-auto shrink-0 space-y-1.5">
      {lockedLabel && (
        <p
          role="alert"
          className="rounded-xl border border-accent/30 bg-accent/8 px-4 py-2.5 text-meta text-foreground"
        >
          This chat was started with {lockedLabel}. Switch back to it in
          Settings to continue.
        </p>
      )}
      <PromptInput
        onSubmit={submit}
        className={`bezel [&_[data-slot=input-group]]:rounded-[calc(var(--radius)+4px)] [&_[data-slot=input-group]]:border-transparent [&_[data-slot=input-group]]:bg-card [&_[data-slot=input-group]]:shadow-[inset_0_1px_0_color-mix(in_oklab,white_60%,transparent)] dark:[&_[data-slot=input-group]]:shadow-none ${isLoading ? "prompt-generating-glow" : ""}`}
      >
        <PromptInputTextarea
          value={text}
          placeholder={
            lockedLabel
              ? `Continue this chat with ${lockedLabel}`
              : "Ask the agent to inspect or change a server…"
          }
          onChange={(e) => setText(e.currentTarget.value)}
          disabled={isLoading || !!lockedLabel}
        />
        <PromptInputFooter>
          {provider ? <ProviderChip provider={provider} /> : <span />}
          <PromptInputSubmit
            status={isLoading ? "streaming" : "ready"}
            onStop={onStop}
            disabled={!!lockedLabel || (!isLoading && !text.trim())}
          />
        </PromptInputFooter>
      </PromptInput>
      <p className="px-3 text-micro text-muted-foreground/70">
        Enter to send, Shift + Enter for a new line
      </p>
    </div>
  );
});
