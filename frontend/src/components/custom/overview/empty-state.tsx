import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, RowIcon } from "@/components/custom/panel";
import type { settings } from "@wails/go/models";

// Shown until a snapshot exists. Which of the three states it lands in depends
// on whether a snapshot is being generated, and whether there is a server to
// generate one from at all.
export function EmptyState({
  generating,
  servers,
  onGenerate,
}: {
  generating: boolean;
  servers: settings.Server[];
  onGenerate: (scope: string) => void;
}) {
  return (
    <div className="grid min-h-[68vh] place-items-center px-4">
      <div className="rise-stagger w-full max-w-md text-center">
        <div className="bezel mx-auto mb-6 w-fit">
          <div className="bezel-core grid size-12 place-items-center text-muted-foreground">
          {generating ? (
            <Loader2 className="size-5 animate-spin text-accent" />
          ) : (
            <Server className="size-5" />
          )}
          </div>
        </div>
        <h1 className="text-title">
          {generating ? "Generating overview…" : "No server connected"}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {generating
            ? "VibeOps is connecting and snapshotting the running services."
            : servers.length
              ? "Pick a server and VibeOps will snapshot its running services."
              : "Add a server in Settings, then VibeOps can snapshot it here."}
        </p>
        {!generating &&
          (servers.length ? (
            <div className="mt-8 text-left">
              <Panel>
              {servers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onGenerate(s.name)}
                  className="group flex w-full cursor-pointer items-center gap-3 border-t border-border/70 px-4 py-3 text-left transition-colors duration-300 first:border-t-0 hover:bg-secondary/50"
                >
                  <RowIcon>
                    <Server className="size-4" />
                  </RowIcon>
                  <div className="min-w-0">
                    <div className="truncate text-item">{s.name}</div>
                    <div className="truncate font-mono text-meta text-muted-foreground">
                      {s.user}@{s.ipAddress}
                    </div>
                  </div>
                  <span className="ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition-[transform,color,background-color] duration-500 ease-(--ease-spring) group-hover:translate-x-0.5 group-hover:bg-accent/15 group-hover:text-accent">
                    <ArrowRight className="size-3.5" />
                  </span>
                </button>
              ))}
              </Panel>
            </div>
          ) : (
            <Button asChild variant="accent" className="mt-8">
              <Link to="/settings">Add a server</Link>
            </Button>
          ))}
      </div>
    </div>
  );
}
