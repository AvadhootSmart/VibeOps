import { useEffect, useState } from "react";
import { Check, Models } from "@wails/go/tools/Harness";
import { logError, notifyError } from "@/lib/notify";
import { getConfig, setAgentModel, type Harness } from "@/lib/config";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { Provider } from "@/components/custom/settings/provider";
import { AI_PROVIDERS } from "@/lib/constants";

// A provider row backed by a coding-agent CLI the user installed themselves.
// Unlike OpenRouter there's no key to store — the CLI carries its own auth — so
// this only detects the binary and picks a model.
//
// The model list comes from the CLI (`Models`), because Cursor's and opencode's
// catalogues are hundreds of entries long and change weekly. Claude Code has no
// listing command, so it passes `models` explicitly instead.
export function HarnessProvider({
  id,
  label,
  logo,
  invertOnDark,
  loginHint,
  models,
  active,
  expanded,
  onActivate,
}: {
  id: Harness;
  label: string;
  logo: string;
  invertOnDark?: boolean;
  /** Shown when the CLI isn't on PATH — the command the user runs themselves. */
  loginHint: React.ReactNode;
  models?: (version: string) => { id: string; name: string }[];
  active: boolean;
  /** Row is open. Only then is the model list worth a second CLI subprocess. */
  expanded: boolean;
  onActivate: () => void;
}) {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [version, setVersion] = useState("");
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  const [model, setModel] = useState("");
  const [open, setOpen] = useState(false);

  // The collapsed header shows detection, so the --version probe always runs.
  useEffect(() => {
    Check(id)
      .then((s) => {
        setInstalled(s.installed);
        setVersion(s.version);
      })
      .catch((e) => logError("provider", `Failed to detect ${id}`, e));
    getConfig()
      .then((c) => setModel(c.agentModels[id] ?? ""))
      .catch(() => {});
  }, [id, models]);

  // `cursor-agent models` / `opencode models` each spawn a subprocess and the
  // list is only readable once the row is open, so it waits for that.
  useEffect(() => {
    if (!expanded || !installed) return;
    if (models) setOptions(models(version));
    else
      Models(id)
        .then(setOptions)
        .catch((e) => logError("provider", `Failed to list ${id} models`, e));
  }, [expanded, installed, version, id, models]);

  async function selectModel(value: string) {
    setModel(value);
    setOpen(false);
    try {
      await setAgentModel(id, value);
    } catch (e) {
      notifyError("Failed to set model", e, { source: "provider" });
    }
  }

  return (
    <Provider
      showToggle
      value={id}
      label={label}
      logo={logo}
      version={version}
      invertOnDark={invertOnDark}
      stage={AI_PROVIDERS[id].stage}
      available={!!installed}
      status={
        installed === null
          ? `Checking for the ${label} CLI…`
          : installed
            ? "Detected · uses your own subscription."
            : `Not found — the ${label} CLI is not on PATH.`
      }
      active={active}
      onToggle={onActivate}
    >
      <div className="space-y-2">
        <Label>Model</Label>
        {installed ? (
          <ModelSelector open={open} onOpenChange={setOpen}>
            <ModelSelectorTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between font-mono font-normal"
              >
                <span className="flex items-center gap-2 truncate">
                  {options.find((m) => m.id === model)?.name ||
                    model ||
                    "Default (CLI's own)"}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </ModelSelectorTrigger>
            <ModelSelectorContent>
              <ModelSelectorInput placeholder="Search models…" />
              <ModelSelectorList>
                <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                <ModelSelectorGroup>
                  <ModelSelectorItem
                    value="Default (CLI's own)"
                    onSelect={() => selectModel("")}
                  >
                    <ModelSelectorName>Default (CLI's own)</ModelSelectorName>
                    {model === "" && (
                      <CheckIcon className="ml-auto size-4" />
                    )}
                  </ModelSelectorItem>
                  {options.map((m) => (
                    <ModelSelectorItem
                      key={m.id}
                      value={`${m.name} ${m.id}`}
                      onSelect={() => selectModel(m.id)}
                    >
                      <ModelSelectorName>{m.name}</ModelSelectorName>
                      <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                        {m.id}
                      </span>
                      {model === m.id && (
                        <CheckIcon className="ml-auto size-4" />
                      )}
                    </ModelSelectorItem>
                  ))}
                </ModelSelectorGroup>
              </ModelSelectorList>
            </ModelSelectorContent>
          </ModelSelector>
        ) : (
          <p className="text-xs text-muted-foreground">{loginHint}</p>
        )}
      </div>
    </Provider>
  );
}
