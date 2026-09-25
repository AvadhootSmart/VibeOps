import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApproveNextTurn } from "@wails/go/tools/Tool";
import { payload, type Impact, type PlanProposal } from "./parse";

const IMPACT: Record<Impact, { label: string; className: string }> = {
  safe: { label: "Safe", className: "bg-ok-soft text-ok" },
  caution: { label: "Changes things", className: "bg-warn-soft text-warn" },
  destructive: { label: "Hard to undo", className: "bg-err-soft text-err" },
};

// Drawn from the arguments of a proposePlan call. The approve button is handed
// down only for the last turn (assistant.tsx): an older plan in the scrollback
// has already been answered, and re-approving it would run a stale plan.
export function PlanCard({
  input,
  onApprove,
}: {
  input: unknown;
  onApprove?: (message: string) => void;
}) {
  const data = payload<PlanProposal>(input);
  if (!data?.steps?.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="space-y-1 border-b bg-secondary/40 px-4 py-3">
        <p className="eyebrow text-muted-foreground">
          Deployment plan
        </p>
        {data.summary && (
          <p className="text-sm leading-relaxed">{data.summary}</p>
        )}
      </div>

      <ol className="space-y-4 px-4 py-4">
        {data.steps.map((step, i) => {
          const impact = IMPACT[step.impact ?? "caution"] ?? IMPACT.caution;
          return (
            <li key={step.title} className="relative flex gap-3">
              {/* Connector between the step numbers, stopping at the last. */}
              {i < data.steps.length - 1 && (
                <span className="absolute top-7 left-[11px] h-[calc(100%+0.25rem)] w-px bg-border" />
              )}
              <span className="z-10 grid size-6 shrink-0 place-items-center rounded-full border bg-card text-micro font-semibold text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{step.title}</span>
                  {step.service && (
                    <span className="rounded-full border px-2 py-0.5 text-micro text-muted-foreground">
                      {step.service}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-micro font-semibold ${impact.className}`}
                  >
                    {impact.label}
                  </span>
                </div>
                {step.detail && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {onApprove && (
        <div className="flex flex-wrap items-center gap-3 border-t bg-secondary/40 px-4 py-3">
          <Button
            variant="accent"
            size="sm"
            // Pre-approves the turn this message starts, so the plan's commands
            // don't each stop for the per-command approval prompt.
            onClick={() =>
              ApproveNextTurn().then(() => onApprove("Go ahead — run this plan as it stands."))
            }
          >
            <Check /> Go ahead
          </Button>
          <span className="text-xs text-muted-foreground">
            Or tell the agent what to change below.
          </span>
        </div>
      )}
    </div>
  );
}
