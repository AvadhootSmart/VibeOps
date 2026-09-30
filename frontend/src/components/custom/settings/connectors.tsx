import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  CheckAll,
  CheckAuth,
  Connect,
  Install,
} from "@wails/go/connectors/Connectors";
import { connectors } from "@wails/go/models";
import { EventsOn } from "@wails/runtime/runtime";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, PanelRow } from "@/components/custom/panel";
import { BETA_CONNECTORS, connectorLogos } from "@/lib/constants";
import { StageBadge } from "@/components/custom/stage-badge";
import { ConnectorOutput } from "@/components/custom/settings/connector-output";
import { requestSecret, SUDO_SECRET } from "@/lib/ai/secrets";
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

// Enough for a login's code and URL, not so much that brew's install log
// buries them.
const OUTPUT_LINES = 12;

export function Connectors() {
  const [connectors, setConnectors] = useState<connectors.Status[]>([]);
  // The connector a step is running for, and which step — installing the CLI,
  // authenticating it and re-checking it are separate actions.
  const [busy, setBusy] = useState<{ name: string; step: Step } | null>(null);
  const [loading, setLoading] = useState(true);
  // Live CLI output per connector, for the step running now or the one that
  // just failed.
  const [output, setOutput] = useState<Record<string, string[]>>({});

  useEffect(() => {
    checkAll();
    return EventsOn("connector:output", (name: string, line: string) =>
      setOutput((all) => ({
        ...all,
        [name]: [...(all[name] ?? []), line].slice(-OUTPUT_LINES),
      })),
    );
  }, []);

  async function checkAll() {
    try {
      setConnectors(await CheckAll());
    } catch (e) {
      notifyError("Failed to check connectors", e, {
        fixable: true,
        source: "connector",
      });
    } finally {
      setLoading(false);
    }
  }

  async function run(name: string, step: Step) {
    setBusy({ name, step });
    setOutput((all) => ({ ...all, [name]: [] }));
    try {
      if (step === "check") {
        const status = await CheckAuth(name);
        setConnectors((all) => all.map((c) => (c.name === name ? status : c)));
      } else {
        await (step === "install" ? install(name) : Connect(name));
        await checkAll();
      }
      setOutput((all) => ({ ...all, [name]: [] }));
    } catch (e) {
      notifyError(`Failed to ${step} ${name}`, e, {
        fixable: true,
        source: "connector",
      });
    } finally {
      setBusy(null);
    }
  }

  // The apt installers inside WSL need sudo; Go says so when it has no
  // password, or a wrong one, and the sudo dialog hands it one. Cancel stops.
  async function install(name: string) {
    for (;;) {
      try {
        return await Install(name);
      } catch (e) {
        if (String(e) !== "sudo password required") throw e;
        if (!(await requestSecret(SUDO_SECRET, `install ${name}`))) return;
      }
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
            <PanelRow key={c.name} className="flex-wrap">
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
                {c.sharesCredentials && (
                  <div className="truncate text-meta text-muted-foreground">
                    {c.authenticated ? "Shares" : "Connecting shares"}{" "}
                    <code>{c.sharesCredentials}</code> with the assistant's shell
                  </div>
                )}
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
              <ConnectorOutput lines={output[c.name] ?? []} />
            </PanelRow>
          );
        })}
    </Panel>
  );
}
