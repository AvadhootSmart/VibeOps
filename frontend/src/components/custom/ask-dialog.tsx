import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAsk } from "@/lib/stores/ask";
import { notifyIfAway } from "@/lib/notify";

// The agent is blocked on this, so it is modal and has no dismiss: closing it
// without an answer would leave the run hanging until the Go side times out.
export function AskDialog() {
  const { pending, answer, init } = useAsk();
  const [other, setOther] = useState("");

  useEffect(init, [init]);

  const question = pending[0];
  // A new question reuses the dialog, so the half-typed answer to the last one
  // must not carry over into it.
  useEffect(() => setOther(""), [question?.id]);

  useEffect(() => {
    if (question) notifyIfAway(question.header || "The agent has a question", question.question);
  }, [question?.id]);

  if (!question) return null;

  const send = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) answer(question.id, trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6">
      <div className="flex w-full max-w-[460px] flex-col gap-4 rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-1.5">
          {question.header && (
            <span className="w-fit rounded-full border px-2 py-0.5 eyebrow text-muted-foreground">
              {question.header}
            </span>
          )}
          <p className="text-sm leading-relaxed">{question.question}</p>
          {question.command && (
            <pre className="mt-1 max-h-48 overflow-auto rounded-lg border bg-secondary/40 px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all">
              {question.command}
            </pre>
          )}
        </div>

        {question.options?.length > 0 && (
          <div className="flex flex-col gap-2">
            {question.options.map((option) => (
              <Button
                key={option}
                variant="outline"
                className="h-auto justify-start py-2 text-left whitespace-normal"
                onClick={() => send(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        )}

        {/* Always offered: the agent's options may not cover the real answer. */}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(other);
          }}
        >
          <Input
            autoFocus
            value={other}
            placeholder={
              question.options?.length ? "Or answer in your own words…" : "Your answer…"
            }
            onChange={(e) => setOther(e.target.value)}
          />
          <Button type="submit" disabled={!other.trim()}>
            Send
          </Button>
        </form>

        {pending.length > 1 && (
          <p className="text-micro text-muted-foreground">
            {pending.length - 1} more question{pending.length > 2 ? "s" : ""} waiting
          </p>
        )}
      </div>
    </div>
  );
}