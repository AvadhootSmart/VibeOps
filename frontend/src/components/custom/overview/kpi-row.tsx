import type { overview } from "@wails/go/models";
import { Panel } from "@/components/custom/panel";
import { age, needsAttention } from "@/components/custom/overview/derive";
import { cn } from "@/lib/utils";

function Kpi({
  label,
  value,
  unit,
  lead,
  warn,
}: {
  label: string;
  value: string | number;
  unit?: string;
  lead?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={lead ? "sm:col-span-2" : undefined}>
      <Panel
        className={cn(
          "flex h-full flex-col justify-between px-5 py-4",
          lead &&
            "bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_60%)]",
        )}
      >
        <div className="text-meta text-muted-foreground">{label}</div>
        {/* Baseline-aligned so the unit hangs off the number instead of
            floating beside it. */}
        <div className="mt-6 flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-metric tabular-nums",
              lead && "text-[2.75rem]",
              warn && "text-warn",
            )}
          >
            {value}
          </span>
          {unit && (
            <span className="text-meta font-medium text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
      </Panel>
    </div>
  );
}

// Only figures a one-off snapshot can state truthfully. CPU, memory and traffic
// are left out on purpose: without polling they'd be stale by the next glance.
export function KpiRow({ data }: { data: overview.Data }) {
  const apps = data.apps ?? [];
  const attention = needsAttention(data);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi
        lead
        label="Apps running"
        value={apps.filter((a) => a.status === "running").length}
        unit={`/ ${apps.length}`}
      />
      <Kpi label="Needs attention" value={attention} warn={attention > 0} />
      <Kpi label="Last snapshot" value={age(data.updatedAt)} unit="ago" />
    </div>
  );
}
