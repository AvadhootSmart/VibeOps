import type { overview } from "@wails/go/models";
import { Panel } from "@/components/custom/panel";
import { cn } from "@/lib/utils";

// CPU / Memory / Requests are placeholders until real metrics land — they're
// shown static regardless of the snapshot. Only "Apps running" is derived.
const PLACEHOLDERS = [
  { label: "Avg CPU", value: "—", unit: "%" },
  { label: "Memory", value: "—", unit: "/ 8 GB" },
  { label: "Requests / min", value: "—", unit: "" },
];

function Kpi({
  label,
  value,
  unit,
  lead,
}: {
  label: string;
  value: string | number;
  unit?: string;
  // The one real figure gets the wider tile and the accent wash; the
  // placeholders beside it stay quiet until they carry data too.
  lead?: boolean;
}) {
  return (
    <div className={lead ? "sm:col-span-3 lg:col-span-2" : undefined}>
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
            className={cn("text-metric tabular-nums", lead && "text-[2.75rem]")}
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

export function KpiRow({ apps }: { apps: overview.App[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Kpi
        lead
        label="Apps running"
        value={apps.filter((a) => a.status === "running").length}
        unit={`/ ${apps.length}`}
      />
      {PLACEHOLDERS.map((k) => (
        <Kpi key={k.label} {...k} />
      ))}
    </div>
  );
}
