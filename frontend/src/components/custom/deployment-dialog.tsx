import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChangeCwd,
  ChooseDirectory,
  CloneRepo,
  ShellPath,
  WorkspacesDir,
} from "@wails/go/main/App";
import { GetAllowedServers } from "@wails/go/settings/Settings";
import { CheckAll } from "@wails/go/connectors/Connectors";
import type { connectors, settings } from "@wails/go/models";
import { notifyError } from "@/lib/notify";

// Collects just enough to hand the deployment to the agent: where the code is,
// and optionally where it should go. Everything else — stack detection, DB
// choice, env vars, the plan — happens in the conversation, because the agent
// can only propose a sane target after it has read the repo. A GitHub repo is
// not a second flow: it's a clone step in front of the local-directory one.
//
// Deliberately absent: domain configuration (connectors hand out a URL; custom
// domains are a follow-up) and any local deployment record — the provider owns
// that state.

const AUTO = "__auto__";

// Names the chat after the project, so the sidebar reads "my-app" and not
// "Deployment" for every deployment the user has ever started.
const projectName = (dir: string) =>
  dir.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "Deployment";

export function DeploymentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<"local" | "github">("local");
  const [path, setPath] = useState("");
  const [repo, setRepo] = useState("");
  const [target, setTarget] = useState(AUTO);
  const [servers, setServers] = useState<settings.Server[]>([]);
  const [connectors, setConnectors] = useState<connectors.Status[]>([]);
  // Absolute, resolved by Go and already created — never "~", which only
  // expands unquoted once it reaches a shell.
  const [workspaces, setWorkspaces] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    GetAllowedServers().then(setServers);
    CheckAll().then((c) => setConnectors(c.filter((x) => x.installed)));
    WorkspacesDir().then(setWorkspaces);
  }, [open]);

  const source = kind === "local" ? path.trim() : repo.trim();

  // Checkout and cd happen here, not in the conversation: the agent starts with
  // the project already under its cwd, so step 1 is the scan.
  async function deploy() {
    if (!source || busy) return;
    setBusy(true);
    let dir: string;
    let name: string;
    try {
      dir = kind === "local" ? source : await CloneRepo(source);
      await ChangeCwd(dir);
      // Taken from the checkout path rather than the repo URL, so a clone and
      // a local folder of the same project land on the same name.
      name = projectName(dir);
      // The prompt below hands this path to the agent, whose shell is WSL on
      // Windows — where C:\ is /mnt/c and a backslash is an escape character.
      dir = await ShellPath(dir);
    } catch (e) {
      notifyError("Could not prepare the project", e);
      return;
    } finally {
      setBusy(false);
    }

    const targetLine =
      target === AUTO
        ? `The user has not picked a target. Recommend one per service from what you find, and say why.`
        : `The user's preferred target is: ${target} — put every service there that can actually run there, and name the ones that can't and where they should go instead.`;

    const prompt = [
      `Deploy the project in the current working directory (${dir}). It is already checked out and every command you run starts there — do not clone it and do not cd elsewhere.`,
      ``,
      `1. Scan the project and identify every deployable service in it — a repo often holds several (web frontend, API, worker, cron, database). For each one: language, framework, build command, how it is served (long-lived process, static output, serverless handler), and what data stores it expects.`,
      `2. Call proposeProviders once, with one entry per service, to show me which provider you recommend for each. Services do not have to land on the same provider — propose the split you would actually make, and use a service's warning field to say which ones must stay together (e.g. a frontend that talks to an API needs that API's URL at build time) or cannot run where you would expect (e.g. it needs a long-lived process, or shells out to a binary like ffmpeg, but the obvious target is serverless). Say that plainly instead of working around it. ${targetLine} Do not write the same information out as a table or a list as well — the card is what I read. Then stop and wait for me.`,
      `3. Once I agree, list the environment variables each service needs, grouped by service. For every secret one — tokens, passwords, connection strings — call secretRequest; never ask me to paste it in the chat. Values you can derive yourself after provisioning (like a DB connection string) should be set directly on the target without ever being printed.`,
      `4. Call proposePlan with the full deployment plan: steps in the order you will run them, so a service is deployed before anything that needs its URL. Write each step the way you would explain it to me out loud — what it does, what it changes, what it costs me if it goes wrong — never the command line you will use. Tag each step's impact. Then stop: I approve from the card, or I reply asking for changes, in which case revise and call proposePlan again with the whole updated plan.`,
      `5. Only once I have approved, run it, then call generateOverview so the app appears on the Overview screen.`,
    ].join("\n");

    onOpenChange(false);
    navigate(
      `/assistant?prompt=${encodeURIComponent(prompt)}&hidden=1&name=${encodeURIComponent(name)}`,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New deployment</DialogTitle>
          <DialogDescription>
            Point VibeOps at your code. It reads the project, proposes a target
            and a plan, and waits for your go-ahead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={kind === "local" ? "secondary" : "outline"}
              onClick={() => setKind("local")}
            >
              <FolderOpen /> Local folder
            </Button>
            <Button
              type="button"
              variant={kind === "github" ? "secondary" : "outline"}
              onClick={() => setKind("github")}
            >
              <Github /> GitHub repo
            </Button>
          </div>

          {kind === "local" ? (
            <div className="space-y-1.5">
              <Label>Project folder</Label>
              <div className="flex gap-2">
                <Input
                  value={path}
                  onChange={(e) => setPath(e.currentTarget.value)}
                  placeholder="/Users/you/projects/my-app"
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => ChooseDirectory().then((p) => p && setPath(p))}
                >
                  Browse
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Repository URL</Label>
              <Input
                value={repo}
                onChange={(e) => setRepo(e.currentTarget.value)}
                placeholder="https://github.com/you/my-app"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Cloned into {workspaces || "your workspaces folder"}/ first,
                then deployed like a local folder.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Deploy to</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO}>
                  Let VibeOps decide after scanning
                </SelectItem>
                {servers.map((s) => (
                  <SelectItem
                    key={s.id}
                    value={`${s.name} (${s.user}@${s.ipAddress})`}
                  >
                    {s.name} · server
                  </SelectItem>
                ))}
                {connectors.map((c) => (
                  <SelectItem key={c.name} value={c.displayName}>
                    {c.displayName}
                    {c.checked && !c.authenticated ? " · not signed in" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {/* A clone needs the resolved workspaces path, not a half-loaded one. */}
          <Button
            variant="accent"
            disabled={!source || busy || (kind === "github" && !workspaces)}
            onClick={deploy}
          >
            {busy ? "Cloning…" : "Start deployment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
