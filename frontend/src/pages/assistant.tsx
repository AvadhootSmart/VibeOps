import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { getConfig, type Provider } from "@/lib/config";
import { useChatSession } from "@/hooks/use-chat-session";
import { Page } from "@/components/custom/page";
import { TurnView } from "@/components/custom/assistant/turn";
import {
  Composer,
  type ComposerHandle,
} from "@/components/custom/assistant/composer";
import { ShellStatus } from "@/components/custom/shell-status";

// Openers for a blank chat. Deliberately the read-only kind: the first thing
// anyone should do with an agent that has a shell is watch it look, not act.
const OPENERS = [
  "What's running on my server right now?",
  "Check disk space and tell me what's safe to clear",
  "Why did the last deploy fail?",
];

export default function Assistant() {
  const { turns, isLoading, run, stop, searchParams, chatProvider } =
    useChatSession();
  const [showToolCalls, setShowToolCalls] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const composer = useRef<ComposerHandle>(null);

  // A harness keeps this conversation inside its own CLI session, so another
  // provider cannot pick it up mid-thread — it would answer with no history.
  const lockedTo =
    chatProvider && provider && chatProvider !== provider ? chatProvider : null;

  // Open at the newest turn and follow the stream, unless the user has
  // scrolled up to read — then leave their position alone until they come
  // back to the bottom.
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  useEffect(() => {
    getConfig()
      .then((c) => {
        setShowToolCalls(c.showToolCalls);
        setProvider(c.provider);
      })
      .catch(() => {});
  }, []);

  // A prompt handed over from another screen (e.g. the deployment dialog)
  // arrives as ?prompt= and starts a fresh chat on its own. run() then replaces
  // the URL with ?session=, dropping the param. ?hidden=1 keeps the machinery
  // prompt out of the transcript — the chat opens straight on the agent's reply.
  //
  // The ref is keyed by the prompt, not a boolean: a second handoff (an error
  // toast's "Fix it" raised while already on this screen) has to fire too.
  const promptParam = searchParams.get("prompt");
  const hiddenParam = searchParams.get("hidden") === "1";
  // The handing-over screen can name the chat too — a deployment is filed
  // under the project, not under "Deployment".
  const nameParam = searchParams.get("name") ?? undefined;
  const handoffRef = useRef<string | null>(null);
  useEffect(() => {
    if (!promptParam || handoffRef.current === promptParam) return;
    handoffRef.current = promptParam;
    run(promptParam, hiddenParam, nameParam);
  }, [promptParam, hiddenParam, nameParam, run]);

  return (
    <Page width="prose" className="flex h-full flex-col gap-5 pb-5">
      <ShellStatus />
      {turns.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center">
          <div className="rise-stagger mx-auto w-full max-w-xl">
            <span className="mb-6 grid size-10 place-items-center rounded-full bg-accent/12 text-accent ring-1 ring-accent/25 ring-inset">
              <Sparkles className="size-4.5" />
            </span>
            <h1 className="text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.035em]">
              How can I help with your servers?
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Propose a change and the agent plans it first. Reply “go” to run.
            </p>
            {/* Openers drop into the composer rather than sending: the point is
                to show the shape of a good ask, and let it be edited. */}
            <div className="mt-8 flex flex-col items-start gap-2">
              {OPENERS.map((opener) => (
                <button
                  key={opener}
                  onClick={() => composer.current?.fill(opener)}
                  className="group inline-flex cursor-pointer items-center gap-3 rounded-full border border-border/80 bg-card/70 py-1.5 pr-1.5 pl-4 text-left text-meta text-muted-foreground transition-[color,border-color,transform] duration-500 ease-(--ease-spring) hover:border-accent/40 hover:text-foreground active:scale-[0.98]"
                >
                  {opener}
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary transition-[transform,background-color,color] duration-500 ease-(--ease-spring) group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:bg-accent/15 group-hover:text-accent">
                    <ArrowUpRight className="size-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className="min-h-0 flex-1 space-y-6 overflow-y-auto"
        >
          {turns.map((turn, i) => (
            <TurnView
              key={turn.id}
              turn={turn}
              streaming={isLoading && i === turns.length - 1}
              showToolCalls={showToolCalls}
              onApprove={
                i === turns.length - 1 && !isLoading && !lockedTo
                  ? run
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <Composer
        ref={composer}
        provider={provider}
        lockedTo={lockedTo}
        isLoading={isLoading}
        onSubmit={run}
        onStop={stop}
      />
    </Page>
  );
}
