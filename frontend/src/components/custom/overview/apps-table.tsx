import { ArrowUpRight, Globe, Server } from "lucide-react";
import {
  StatusBadge,
  type AppStatus,
} from "@/components/custom/overview/status-badge";
import { Panel, RowIcon } from "@/components/custom/panel";
import { BrowserOpenURL } from "@wails/runtime/runtime";
import type { overview } from "@wails/go/models";

const COLUMNS = "grid-cols-[minmax(0,1.7fr)_0.9fr_0.6fr_0.7fr_0.6fr_32px]";
// Figures right-align so the column reads as a column; labels left-align.
const NUM = "text-right text-sm tabular-nums";

function AppRow({ app }: { app: overview.App }) {
  const external = !!app.domain && !app.domain.startsWith("internal");
  const url = app.domain.startsWith("http")
    ? app.domain
    : `https://${app.domain}`;

  return (
    <div
      className={`group grid ${COLUMNS} items-center gap-4 border-t border-border/70 px-5 py-3.5 transition-colors duration-300 hover:bg-secondary/50`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <RowIcon className="size-8">
          {external ? (
            <Globe className="size-4" strokeWidth={1.8} />
          ) : (
            <Server className="size-4" strokeWidth={1.8} />
          )}
        </RowIcon>
        <div className="min-w-0">
          <div className="truncate text-item">{app.name}</div>
          <div className="truncate text-meta text-muted-foreground">
            {app.kind} · {app.provider}
          </div>
        </div>
      </div>
      <StatusBadge status={app.status as AppStatus} />
      {/* CPU / Memory are placeholders for now */}
      <div className={`${NUM} text-muted-foreground`}>—</div>
      <div className={`${NUM} text-muted-foreground`}>—</div>
      <div className={NUM}>{app.uptime}</div>
      {/* The only action a row has. Revealed on hover so a quiet table stays
          quiet, but always reachable by keyboard. */}
      {external ? (
        <button
          title={`Open ${app.domain}`}
          aria-label={`Open ${app.domain}`}
          onClick={() => BrowserOpenURL(url)}
          className="grid size-8 cursor-pointer place-items-center rounded-full text-muted-foreground opacity-0 transition-[opacity,color,background-color,transform] duration-300 ease-(--ease-spring) hover:-translate-y-px hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <ArrowUpRight className="size-4" />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

export function AppsTable({ apps }: { apps: overview.App[] }) {
  return (
    <Panel>
      <div
        className={`grid ${COLUMNS} items-center gap-4 px-5 pt-3.5 pb-2.5 text-meta text-muted-foreground`}
      >
        <span>Application</span>
        <span>Status</span>
        <span className="text-right">CPU</span>
        <span className="text-right">Memory</span>
        <span className="text-right">Uptime</span>
        <span />
      </div>
      {apps.length === 0 ? (
        <p className="border-t border-border/70 px-5 py-10 text-center text-meta text-muted-foreground">
          The last snapshot found nothing running here.
        </p>
      ) : (
        apps.map((app) => (
          <AppRow key={`${app.provider}/${app.name}`} app={app} />
        ))
      )}
    </Panel>
  );
}
