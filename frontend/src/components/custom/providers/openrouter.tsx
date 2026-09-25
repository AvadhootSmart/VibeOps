import { useEffect, useState } from "react";
import { notifyError, notifySuccess } from "@/lib/notify";
import { ChevronsUpDown, Eye, EyeOff } from "lucide-react";
import {
  GetAPIKey,
  SetAPIKey,
  DeleteAPIKey,
} from "@wails/go/settings/Settings";
import { getConfig, patchConfig } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { Provider } from "@/components/custom/settings/provider";
import openrouterLogo from "../../../../images/openrouter.png";

// OpenRouter id prefixes that differ from models.dev logo slugs.
const LOGO_ALIAS: Record<string, string> = {
  "x-ai": "xai",
  "meta-llama": "llama",
  mistralai: "mistral",
  "z-ai": "zai",
};
const logoProvider = (id: string) => {
  const p = id.split("/")[0];
  return LOGO_ALIAS[p] ?? p;
};

// ~2 MB of JSON, and only the expanded row ever reads it. Fetched at most once
// per app run, and not at all if the user never opens this provider.
let catalogue: Promise<{ id: string; name: string }[]> | null = null;
const openRouterModels = () =>
  (catalogue ??= fetch("https://openrouter.ai/api/v1/models")
    .then((r) => {
      if (!r.ok) throw new Error(`Model list failed: ${r.status}`);
      return r.json();
    })
    .then((d) => d.data ?? [])
    .catch(() => {
      catalogue = null; // a failed fetch shouldn't be cached as "no models"
      return [];
    }));

const maskKey = (key: string) =>
  key.length <= 15 ? key : `${key.slice(0, 12)}...${key.slice(-3)}`;

// The OpenRouter row of the provider accordion: API key, model picker, and the
// key's own save/remove. Everything here is this provider's business, so the
// state lives here; the page only owns which provider is active and shows the
// status line the two providers share.
export function OpenRouterProvider({
  active,
  expanded,
  onActivate,
}: {
  active: boolean;
  expanded: boolean;
  onActivate: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [saved, setSaved] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [modelOpen, setModelOpen] = useState(false);

  useEffect(() => {
    if (expanded) openRouterModels().then(setModels);
  }, [expanded]);

  useEffect(() => {
    (async () => {
      try {
        const key = await GetAPIKey();
        if (key) {
          setApiKey(key);
          setSaved(true);
        }
      } catch (e) {
        notifyError("Failed to load key", e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { model } = await getConfig();
        if (model) setModel(model);
      } catch (e) {
        notifyError("Failed to load model", e);
      }
    })();
  }, []);

  async function save() {
    if (!apiKey.trim()) {
      notifyError("Enter a key first.");
      return;
    }
    setIsBusy(true);
    try {
      await SetAPIKey(apiKey.trim()); // -> keychain
      await patchConfig({ model: model.trim() });
      setSaved(true);
      notifySuccess("Saved");
    } catch (e) {
      notifyError("Save failed", e);
    } finally {
      setIsBusy(false);
    }
  }

  async function clear() {
    setIsBusy(true);
    try {
      await DeleteAPIKey();
      await patchConfig({ model: "" });
      setApiKey("");
      setModel("");
      setSaved(false);
      notifySuccess("Removed from keychain.");
    } catch (e) {
      notifyError("Remove failed", e);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Provider
      value="openrouter"
      label="OpenRouter"
      logo={openrouterLogo}
      available={saved}
      showToggle
      status={
        saved
          ? "Connected · API key saved."
          : "Not connected — add an API key below."
      }
      active={active}
      onToggle={onActivate}
    >
      <div className="space-y-2">
        <Label htmlFor="apiKey">API key</Label>
        {saved ? (
          <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 font-mono text-sm">
            <span className="truncate">
              {showKey ? apiKey : maskKey(apiKey)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-7 shrink-0 text-muted-foreground"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
          </div>
        ) : (
          <Input
            id="apiKey"
            type="text"
            placeholder="sk-or-..."
            className="font-mono"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setSaved(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && save()}
            disabled={isBusy}
          />
        )}
      </div>
      <div className="space-y-2">
        <Label>Model</Label>
        <ModelSelector open={modelOpen} onOpenChange={setModelOpen}>
          <ModelSelectorTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between font-mono font-normal"
              disabled={isBusy}
            >
              <span className="flex items-center gap-2 truncate">
                {model && (
                  <ModelSelectorLogo
                    provider={logoProvider(model)}
                    onError={(e) => {
                      e.currentTarget.style.visibility = "hidden";
                    }}
                  />
                )}
                {models.find((m) => m.id === model)?.name ||
                  model ||
                  "Select a model…"}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            </Button>
          </ModelSelectorTrigger>
          <ModelSelectorContent>
            <ModelSelectorInput placeholder="Search models…" />
            <ModelSelectorList>
              <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
              <ModelSelectorGroup>
                {models.map((m) => (
                  <ModelSelectorItem
                    key={m.id}
                    value={`${m.name} ${m.id}`}
                    onSelect={() => {
                      setModel(m.id);
                      setSaved(false);
                      setModelOpen(false);
                    }}
                  >
                    <ModelSelectorLogo
                      provider={logoProvider(m.id)}
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                    <ModelSelectorName>{m.name}</ModelSelectorName>
                    <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                      {m.id}
                    </span>
                  </ModelSelectorItem>
                ))}
              </ModelSelectorGroup>
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </div>
      <div className="flex gap-3 pt-1">
        <Button onClick={save} disabled={isBusy}>
          {isBusy ? "Saving..." : "Save"}
        </Button>
        <Button variant="outline" onClick={clear} disabled={isBusy || !saved}>
          Remove
        </Button>
      </div>
    </Provider>
  );
}
