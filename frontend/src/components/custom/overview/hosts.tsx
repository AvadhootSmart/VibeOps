import { Server } from "lucide-react";
import { Panel, PanelRow, RowIcon } from "@/components/custom/panel";
import { age, DISK_WARN_PCT } from "@/components/custom/overview/derive";
import { cn } from "@/lib/utils";
import type { overview } from "@wails/go/models";

export function Hosts({ hosts }: { hosts: overview.Host[] }) {
  return (
    <Panel>
      {hosts.map((h) => {
        const full = h.diskUsedPct >= DISK_WARN_PCT;
        const up = age(h.bootedAt);
        return (
          <PanelRow key={h.name}>
            <RowIcon>
              <Server className="size-4" />
            </RowIcon>
            <div className="min-w-0">
              <div className="truncate text-item">{h.name}</div>
              <div className="truncate text-meta text-muted-foreground">
                {[h.os, up && `up ${up}`].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="ml-auto w-44 shrink-0">
              <div className="flex justify-between text-meta text-muted-foreground">
                <span>Disk</span>
                <span className={cn("tabular-nums", full && "text-warn")}>
                  {h.diskUsedPct}%{h.diskSize && ` of ${h.diskSize}`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full", full ? "bg-warn" : "bg-ok")}
                  style={{ width: `${Math.min(100, h.diskUsedPct)}%` }}
                />
              </div>
            </div>
          </PanelRow>
        );
      })}
    </Panel>
  );
}
