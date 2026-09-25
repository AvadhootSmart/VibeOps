import {
  Box,
  ChevronDown,
  ChevronRight,
  Clock,
  Cog,
  Database,
  Globe,
  ListChecks,
  Server,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ProviderMark } from "./provider-mark";
import {
  payload,
  stackList,
  type ServiceKind,
  type ProvidersProposal,
} from "./parse";

// What each service IS, as one glyph. This is the half-second read: three rows
// of icons tell you the repo holds a site, an API and a database before a word
// has been read. Tiles stay neutral on purpose — the provider logo is the only
// colour in a row, so that is where the eye lands.
const KIND: Record<ServiceKind, { icon: typeof Globe; label: string }> = {
  frontend: { icon: Globe, label: "Frontend" },
  api: { icon: Server, label: "API" },
  worker: { icon: Cog, label: "Worker" },
  cron: { icon: Clock, label: "Scheduled job" },
  database: { icon: Database, label: "Database" },
  app: { icon: Box, label: "App" },
};

export function ProvidersCard({
  input,
  onApprove,
}: {
  input: unknown;
  onApprove?: (message: string) => void;
}) {
  const data = payload<ProvidersProposal>(input);
  if (!data?.services?.length) return null;

  const { services } = data;
  const targets = [...new Set(services.map((s) => s.provider))];

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="space-y-2 border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-muted-foreground">
            Suggested providers
            <span className="ml-2 normal-case tracking-normal">
              {services.length} service{services.length > 1 ? "s" : ""}
            </span>
          </p>
          {/* Every destination this deployment touches, in one glance. Not
              overlapped: these logos carry their own backgrounds and stacking
              them just makes a smudge. */}
          <div className="flex shrink-0 items-center gap-1.5">
            {targets.map((t) => (
              <ProviderMark key={t} provider={t} size="sm" />
            ))}
          </div>
        </div>
        {data.intro && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {data.intro}
          </p>
        )}
      </div>

      <div className="divide-y">
        {services.map((s, i) => {
          const kind = KIND[s.kind ?? "app"] ?? KIND.app;
          const Icon = kind.icon;
          const stack = stackList(s.stack);
          const hasDetail = Boolean(s.runs || s.why || s.alternatives?.length);
          return (
            <div
              key={s.name}
              className="animate-in fade-in slide-in-from-bottom-2 space-y-2.5 px-4 py-3.5 duration-300"
              style={{
                animationDelay: `${i * 60}ms`,
                animationFillMode: "backwards",
              }}
            >
              {/* The route line: what it is → where it goes. Kept to one row
                  and free of prose, so a stack of them reads as a map. */}
              <div className="flex items-center gap-3">
                <span
                  title={kind.label}
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary"
                >
                  <Icon className="size-4.5" strokeWidth={1.8} />
                </span>

                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{s.name}</div>
                  {s.path && s.path !== "." && (
                    <div className="truncate font-mono text-micro text-muted-foreground">
                      {s.path}
                    </div>
                  )}
                </div>

                <span className="mx-1 flex min-w-4 flex-1 items-center">
                  <span className="h-px flex-1 border-t border-dashed" />
                  <ChevronRight className="-ml-1 size-3.5 text-muted-foreground" />
                </span>

                <div className="flex shrink-0 items-center gap-2">
                  <ProviderMark provider={s.provider} />
                  <span className="text-sm font-semibold">{s.provider}</span>
                </div>
              </div>

              {/* Everything below is indented under the route so it never
                  competes with it. */}
              {stack.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-12">
                  {stack.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-md border bg-background px-1.5 py-0.5 text-micro font-medium text-muted-foreground"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}

              {/* Warnings stay out of the fold. They are the reason to change a
                  pick, so hiding one behind a disclosure defeats the card. */}
              {s.warning && (
                <p className="ml-12 flex gap-2 rounded-lg bg-warn-soft px-2.5 py-2 text-xs leading-relaxed text-warn">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" />
                  {s.warning}
                </p>
              )}

              {hasDetail && (
                <Collapsible className="pl-12">
                  <CollapsibleTrigger className="group flex items-center gap-1 text-micro font-medium text-muted-foreground transition-colors hover:text-foreground">
                    <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-180" />
                    <span className="group-data-[state=open]:hidden">
                      Why this provider
                    </span>
                    <span className="hidden group-data-[state=open]:inline">
                      Hide
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <div className="space-y-2 pt-2">
                      {s.runs && (
                        <p className="text-xs text-muted-foreground">
                          {s.runs}
                        </p>
                      )}
                      {s.why && (
                        <p className="text-meta leading-relaxed">{s.why}</p>
                      )}
                      {s.alternatives?.length ? (
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <span className="text-micro text-muted-foreground">
                            Also runs on
                          </span>
                          {s.alternatives.map((alt) => (
                            <span key={alt} className="flex items-center gap-1.5">
                              <ProviderMark provider={alt} size="sm" />
                              <span className="text-micro text-muted-foreground">
                                {alt}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          );
        })}
      </div>

      {onApprove && (
        <div className="flex flex-wrap items-center gap-3 border-t bg-secondary/40 px-4 py-3">
          <Button
            variant="accent"
            size="sm"
            onClick={() => onApprove("Go with these providers.")}
          >
            <ListChecks /> Create plan
          </Button>
          <span className="text-xs text-muted-foreground">
            Or tell the agent to swap one below.
          </span>
        </div>
      )}
    </div>
  );
}
