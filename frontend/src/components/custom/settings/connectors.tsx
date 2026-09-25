import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  CheckAll,
  CheckAuth,
  Connect,
  Install,
} from "@wails/go/connectors/Connectors";
import { connectors } from "@wails/go/models";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, PanelRow } from "@/components/custom/panel";
import { BETA_CONNECTORS, connectorLogos } from "@/lib/constants";
import { StageBadge } from "@/components/custom/stage-badge";
import { notifyError } from "@/lib/notify";

// The deploy-target CLIs VibeOps can drive (wrangler, vercel, …), with their
// detected state and a one-click install. Fully self-contained: it owns its
// polling, its per-step busy state, and its own error line — errors belong
// under this section, not under whichever section the page happens to render
// a shared status in.
//
// Opening this screen only detects what is installed. Whether a CLI is signed
// in is asked per connector, on a click: for neon and supabase that question
// *is* a login flow, and checking all of them on mount opened browser windows
// for connectors the user never wanted to connect.
type Step = "install" | "connect" | "check";

export function Connectors() {
  const [connectors, setConnectors] = useState<connectors.Status[]>([]);
  // The connector a step is running for, and which step — installing the CLI,
  // authenticating it and re-checking it are separate actions.
  const [busy, setBusy] = useState<{ name: string; step: Step } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAll();
  }, []);

  async function checkAll() {
    try {
      setConnectors(await CheckAll());
    } catch (e) {
      notifyError("Failed to check connectors", e, { fixable: true });
    } finally {
      setLoading(false);
    }
  }

  async function run(name: string, step: Step) {
    setBusy({ name, step });
    try {
      if (step === "check") {
        const status = await CheckAuth(name);
        setConnectors((all) => all.map((c) => (c.name === name ? status : c)));
      } else {
        await (step === "install" ? Install(name) : Connect(name));
        await checkAll();
      }
    } catch (e) {
      notifyError(`Failed to ${step} ${name}`, e, { fixable: true });
    } finally {
      setBusy(null);
    }
  }

  function detail(c: connectors.Status) {
    if (!c.installed) return "Not installed";
    if (!c.checked) return "Installed · sign-in not checked";
    return c.authenticated ? "Connected" : "Installed, not connected";
  }

  return (
    <Panel>
      {loading &&
        [0, 1].map((i) => (
          <PanelRow key={i}>
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="ml-auto h-9 w-24 rounded-md" />
          </PanelRow>
        ))}
      {!loading &&
        connectors.map((c) => {
          const running = busy?.name === c.name ? busy.step : null;
          return (
            <PanelRow key={c.name}>
              {connectorLogos[c.name] && (
                <img
                  src={connectorLogos[c.name]}
                  alt=""
                  className="size-9 shrink-0 rounded-lg object-contain"
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-item">
                  {c.displayName}
                  {BETA_CONNECTORS.includes(c.name) && <StageBadge stage="beta" />}
                </div>
                <div className="truncate text-meta text-muted-foreground">
                  {c.name} · {detail(c)}
                </div>
              </div>
              {!c.installed ? (
                <Button
                  variant="outline"
                  className="ml-auto"
                  disabled={busy !== null}
                  onClick={() => run(c.name, "install")}
                >
                  {running === "install" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Installing…
                    </>
                  ) : (
                    "Install"
                  )}
                </Button>
              ) : !c.checked || c.authenticated ? (
                <Button
                  variant={c.authenticated ? "ghost" : "outline"}
                  className="ml-auto"
                  disabled={busy !== null}
                  // The CLI's own check may open a browser when it isn't signed
                  // in — worth saying before the window appears.
                  title="Ask this CLI whether it is signed in. It may open a browser."
                  onClick={() => run(c.name, "check")}
                >
                  {running === "check" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Checking…
                    </>
                  ) : c.authenticated ? (
                    <RefreshCw className="size-4" />
                  ) : (
                    "Check sign-in"
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="ml-auto"
                  disabled={busy !== null}
                  onClick={() => run(c.name, "connect")}
                >
                  {running === "connect" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              )}
            </PanelRow>
          );
        })}
    </Panel>
  );
}
