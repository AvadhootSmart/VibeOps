import type { Provider } from "@/lib/config";
import { AI_PROVIDERS, experimentalWarning } from "@/lib/constants";
import { StageBadge } from "@/components/custom/stage-badge";

// Which provider the next message will go to, shown in the composer so the
// answer's origin is never a guess.
export function ProviderChip({ provider }: { provider: Provider }) {
  const { label, logo, invertOnDark, stage } = AI_PROVIDERS[provider];
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-micro text-muted-foreground">
      <img
        src={logo}
        alt=""
        className={`size-3.5 shrink-0 rounded-sm object-contain ${invertOnDark ? "dark:invert" : ""}`}
      />
      <span className="truncate">{label}</span>
      {stage && <StageBadge stage={stage} reason={experimentalWarning(label)} />}
    </span>
  );
}
