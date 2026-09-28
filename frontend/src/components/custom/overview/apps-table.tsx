import { ArrowUpRight, Globe, Server } from "lucide-react";
import {
  StatusBadge,
  type AppStatus,
} from "@/components/custom/overview/status-badge";
import { Panel, RowIcon } from "@/components/custom/panel";
import {
  age,
  certExpiring,
  daysUntil,
} from "@/components/custom/overview/derive";
import { BrowserOpenURL } from "@wails/runtime/runtime";
import type { overview } from "@wails/go/models";

const COLUMNS =
  "grid-cols-[minmax(0,1.5fr)_0.8fr_minmax(0,1.4fr)_0.5fr]";

function Domain({ app }: { app: overview.App }) {
  if (!app.domain) return <span className="text-muted-foreground">—</span>;
  if (app.domain.startsWith("internal")) {
    return (
      <span className="truncate font-mono text-meta text-muted-foreground">
        {app.domain}
      </span>
    );
  }

  const host = app.domain.replace(/^https?:\/\//, "");
  const days = daysUntil(app.certExpires);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        title={
          days === null
            ? `Open ${host}`
            : `Certificate valid until ${new Date(app.certExpires).toLocaleDateString()}`
        }
        onClick={() => BrowserOpenURL(`https://${host}`)}
        className="group/link inline-flex min-w-0 cursor-pointer items-center gap-1 text-sm transition-colors hover:text-accent"
      >
        <span className="truncate">{host}</span>
        <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
      </button>
      {/* Certificates only speak up when they're about to be a problem. */}
      {certExpiring(app) && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-meta font-medium ${days! <= 0 ? "bg-err-soft text-err" : "bg-warn-soft text-warn"}`}
        >
          {days! <= 0 ? "cert expired" : `cert ${days}d`}
        </span>
      )}
    </div>
  );
}

function AppRow({ app }: { app: overview.App }) {
  const external = !!app.domain && !app.domain.startsWith("internal");
  return (
    <div
      className={`grid ${COLUMNS} items-center gap-4 border-t border-border/70 px-5 py-3.5 transition-colors duration-300 hover:bg-secondary/50`}
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
      <Domain app={app} />
      <div
        className="text-right text-sm tabular-nums"
        title={app.since && new Date(app.since).toLocaleString()}
      >
        {age(app.since) || <span className="text-muted-foreground">—</span>}
      </div>
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
        <span>Domain</span>
        {/* Since start on a server, since the last deploy on a platform. */}
        <span className="text-right">Live for</span>
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
