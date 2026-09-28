import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Camera, Loader2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, RowIcon } from "@/components/custom/panel";
import { connectorLogos } from "@/lib/constants";
import type { settings } from "@wails/go/models";

const CAPTURES = ["App status", "Domains", "TLS certificates", "Disk usage"];

function Source({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center gap-3 border-t border-border/70 px-4 py-3 text-left transition-colors duration-300 first:border-t-0 hover:bg-secondary/50"
    >
      {icon}
      <div className="min-w-0">
        <div className="truncate text-item">{title}</div>
        <div className="truncate text-meta text-muted-foreground">{detail}</div>
      </div>
      <span className="ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition-[transform,color,background-color] duration-500 ease-(--ease-spring) group-hover:translate-x-0.5 group-hover:bg-accent/15 group-hover:text-accent">
        <ArrowRight className="size-3.5" />
      </span>
    </button>
  );
}

// Shown until the first snapshot lands. The pitch is that it's a snapshot:
// VibeOps reads once and keeps the result, nothing polls in the background.
export function EmptyState({
  generating,
  error,
  servers,
  onGenerate,
  onStop,
}: {
  generating: boolean;
  error?: string;
  servers: settings.Server[];
  onGenerate: (scope: string) => void;
  onStop: () => void;
}) {
  return (
    <div className="grid min-h-[68vh] place-items-center px-4">
      <div className="rise-stagger w-full max-w-md text-center">
        <div className="bezel mx-auto mb-6 w-fit">
          <div className="bezel-core grid size-12 place-items-center text-muted-foreground">
            {generating ? (
              <Loader2 className="size-5 animate-spin text-accent" />
            ) : (
              <Camera className="size-5" />
            )}
          </div>
        </div>
        <h1 className="text-title">
          {generating ? "Taking a snapshot…" : "No snapshot yet"}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {generating
            ? "VibeOps is reading what's running. This usually takes a minute or two."
            : "VibeOps reads your apps once and keeps the result here until you refresh. Nothing polls in the background."}
        </p>

        {generating ? (
          <Button variant="ghost" className="mt-8" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <>
            <ul className="mt-5 flex flex-wrap justify-center gap-1.5">
              {CAPTURES.map((c) => (
                <li
                  key={c}
                  className="rounded-full bg-secondary px-2.5 py-1 text-meta text-muted-foreground"
                >
                  {c}
                </li>
              ))}
            </ul>

            {error && (
              <p className="mx-auto mt-6 max-w-sm text-meta text-err">
                The last snapshot failed: {error}
              </p>
            )}

            <div className="mt-8 text-left">
              <Panel>
                {servers.map((s) => (
                  <Source
                    key={s.id}
                    icon={
                      <RowIcon>
                        <Server className="size-4" />
                      </RowIcon>
                    }
                    title={s.name}
                    detail={`${s.user}@${s.ipAddress}`}
                    onClick={() => onGenerate(s.name)}
                  />
                ))}
                <Source
                  icon={
                    <img
                      src={connectorLogos.vercel}
                      alt=""
                      className="size-9 shrink-0 rounded-lg object-contain"
                    />
                  }
                  title="Vercel"
                  detail="Projects from the signed-in Vercel CLI"
                  onClick={() => onGenerate("vercel")}
                />
              </Panel>
            </div>

            <div className="mt-6 flex justify-center gap-2">
              {servers.length > 0 && (
                <Button variant="accent" onClick={() => onGenerate("all")}>
                  Snapshot everything
                </Button>
              )}
              <Button asChild variant={servers.length ? "ghost" : "accent"}>
                <Link to="/settings">Add a server</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
