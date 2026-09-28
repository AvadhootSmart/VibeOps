import { useEffect, useState } from "react";
import { Plus, Sparkle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Page, PageHeader } from "@/components/custom/page";
import { RefreshControl } from "@/components/custom/overview/refresh-control";
import { EmptyState } from "@/components/custom/overview/empty-state";
import { KpiRow } from "@/components/custom/overview/kpi-row";
import { AppsTable } from "@/components/custom/overview/apps-table";
import { Hosts } from "@/components/custom/overview/hosts";
import { DeploymentDialog } from "@/components/custom/deployment-dialog";
import { runAgent } from "@/lib/ai";
import { useGenerationStore, useIsGenerating } from "@/lib/stores/generation";
import { Get } from "@wails/go/overview/Overview";
import { GetAllowedServers } from "@wails/go/settings/Settings";
import { EventsOn } from "@wails/runtime/runtime";
import type { overview, settings } from "@wails/go/models";

// The snapshot is written by the agent, not read directly: this asks it to
// gather from each source the user has connected and call generateOverview once
// with the combined list.
function overviewPrompt(servers: settings.Server[], scope: string) {
  const targets =
    scope === "vercel"
      ? []
      : servers.filter((s) => scope === "all" || s.name === scope);
  const sources = [
    ...targets.map(
      (s) =>
        `SSH into "${s.name}" (${s.user}@${s.ipAddress}:${s.port || 22}) and snapshot the running services (use provider "${s.name}").`,
    ),
    ...(scope === "all" || scope === "vercel"
      ? [
          `If the Vercel CLI is authed (\`vercel whoami\`), run \`vercel project ls\` and include those apps with provider "vercel" (name = project, domain = Latest Production URL, certExpires = ""). Use \`vercel ls <project> --prod\` for each project's latest production deployment: its status and when it was created (since).`,
        ]
      : []),
  ];
  if (!sources.length) return null;
  return (
    `Generate the apps overview. Gather from the sources below, then call generateOverview ONCE with the combined list:\n` +
    sources.map((s, i) => `${i + 1}. ${s}`).join("\n") +
    `\nIGNORE Cloudflare for now.`
  );
}

export default function Overview() {
  const [data, setData] = useState<overview.Data | null>(null);
  const [servers, setServers] = useState<settings.Server[]>([]);
  const [deployOpen, setDeployOpen] = useState(false);
  const [scope, setScope] = useState("all");
  const generating = useIsGenerating("overview");
  const error = useGenerationStore((s) => s.runs.overview?.error);

  useEffect(() => {
    Get().then(setData);
    GetAllowedServers().then(setServers);
    // The generateOverview tool emits this after the agent writes a snapshot.
    return EventsOn("overview:updated", () => Get().then(setData));
  }, []);

  async function generate(nextScope: string) {
    const prompt = overviewPrompt(servers, nextScope);
    if (!prompt) return;

    const controller = new AbortController();
    const { start, finish } = useGenerationStore.getState();
    start("overview", () => controller.abort());
    try {
      await runAgent(
        [{ role: "user", content: prompt }],
        undefined,
        controller.signal,
      );
      setData(await Get());
      finish("overview");
    } catch (e) {
      finish("overview", e instanceof Error ? e.message : String(e));
    }
  }

  if (data === null) return <OverviewSkeleton />;

  if (!data.updatedAt) {
    return (
      <EmptyState
        generating={generating}
        error={error}
        servers={servers}
        onGenerate={generate}
        onStop={() => useGenerationStore.getState().stop("overview")}
      />
    );
  }

  return (
    <Page>
      <PageHeader
        title="Overview"
        description={data.summary || "Everything VibeOps is currently running."}
        adornment={
          <RefreshControl
            scope={scope}
            serverNames={servers.map((s) => s.name)}
            generating={generating}
            onRefresh={(next) => {
              setScope(next);
              generate(next);
            }}
          />
        }
        actions={
          <Button variant="accent" onClick={() => setDeployOpen(true)}>
            <Plus /> Deploy
          </Button>
        }
      />
      <DeploymentDialog open={deployOpen} onOpenChange={setDeployOpen} />

      {error && !generating && (
        <p className="-mt-6 mb-6 text-meta text-err">
          The last refresh failed: {error}
        </p>
      )}

      <KpiRow data={data} />

      {/* The agent's read on the snapshot. A thin accent rule and mark rather
          than a tinted alert box: this is VibeOps talking, not a warning. */}
      {data.insight && (
        <section className="mt-10 flex gap-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/12 text-accent ring-1 ring-accent/25 ring-inset">
            <Sparkle className="size-3.5 fill-current" />
          </span>
          <div className="min-w-0 pt-1">
            <h2 className="text-item text-accent">VibeOps noticed</h2>
            <p className="mt-1 max-w-[65ch] text-sm leading-relaxed">
              {data.insight}
            </p>
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="mb-4 text-section">Applications</h2>
        <AppsTable apps={data.apps ?? []} />
      </section>

      {!!data.hosts?.length && (
        <section className="mt-12">
          <h2 className="mb-4 text-section">Servers</h2>
          <Hosts hosts={data.hosts} />
        </section>
      )}
    </Page>
  );
}

// Shown for the beat between mount and the first snapshot read. Shaped like
// the real page so nothing jumps when it arrives.
function OverviewSkeleton() {
  return (
    <Page>
      <PageHeader title="Overview" description="Reading the last snapshot…" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-[116px] rounded-2xl sm:col-span-2" />
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[116px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-12 h-[240px] rounded-2xl" />
    </Page>
  );
}
