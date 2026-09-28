import { useEffect, useState } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Section } from "@/components/custom/settings/section";
import { OpenRouterProvider } from "@/components/custom/providers/openrouter";
import { ClaudeCodeProvider } from "@/components/custom/providers/claude-code";
import { CursorProvider } from "@/components/custom/providers/cursor";
import { OpencodeProvider } from "@/components/custom/providers/opencode";
import { ConfirmDialog } from "@/components/custom/confirm-dialog";
import { AI_PROVIDERS, experimentalWarning } from "@/lib/constants";
import { notifyError } from "@/lib/notify";
import {
  getConfig,
  patchConfig,
  type Provider as ProviderId,
} from "@/lib/config";

// The provider accordion. Each row owns its own credentials and model choice;
// all this holds is which one is selected, and which row is expanded.
export function Providers() {
  const [provider, setProvider] = useState<ProviderId>("openrouter");
  // Every row can expand, including the two that aren't selectable yet.
  const [open, setOpen] = useState<string | null>(null);
  // An Experimental provider waiting on its one-time acknowledgement.
  const [pendingAck, setPendingAck] = useState<ProviderId | null>(null);

  useEffect(() => {
    getConfig()
      .then((c) => setProvider(c.provider))
      .catch(() => {});
  }, []);

  async function select(p: ProviderId) {
    if (AI_PROVIDERS[p].stage === "experimental") {
      const { experimentalAck } = await getConfig();
      if (!experimentalAck.includes(p)) return setPendingAck(p);
    }
    setProvider(p);
    try {
      await patchConfig({ provider: p });
    } catch (e) {
      notifyError("Failed to switch provider", e, { source: "provider" });
    }
  }

  async function acknowledge(p: ProviderId) {
    const { experimentalAck } = await getConfig();
    await patchConfig({ experimentalAck: [...experimentalAck, p] });
    await select(p);
  }

  return (
    <Section
      title="AI provider"
      description="Used by the Assistant to call models. Stored in your OS keychain, never on disk in plain text."
    >
      <Accordion
        type="single"
        collapsible
        value={open ?? undefined}
        onValueChange={(v) => setOpen(v || null)}
        className="overflow-hidden rounded-xl border bg-card"
      >
        {/* `expanded` gates each row's expensive detection — a model-list
            fetch, or a CLI subprocess — so opening Settings doesn't pay for
            four providers when at most one row is on screen. */}
        <OpenRouterProvider
          active={provider === "openrouter"}
          expanded={open === "openrouter"}
          onActivate={() => select("openrouter")}
        />
        <ClaudeCodeProvider
          active={provider === "claude-code"}
          expanded={open === "claude-code"}
          onActivate={() => select("claude-code")}
        />
        <CursorProvider
          active={provider === "cursor"}
          expanded={open === "cursor"}
          onActivate={() => select("cursor")}
        />
        <OpencodeProvider
          active={provider === "opencode"}
          expanded={open === "opencode"}
          onActivate={() => select("opencode")}
        />
      </Accordion>
      {pendingAck && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPendingAck(null)}
          title={`Use ${AI_PROVIDERS[pendingAck].label}? It's experimental.`}
          description={experimentalWarning(AI_PROVIDERS[pendingAck].label)}
          confirmLabel="I understand, use it"
          onConfirm={() => acknowledge(pendingAck)}
        />
      )}
    </Section>
  );
}
