import { useEffect, useState } from "react";
import { getConfig, patchConfig } from "@/lib/config";
import { Page, PageHeader } from "@/components/custom/page";
import { Panel } from "@/components/custom/panel";
import { Section } from "@/components/custom/settings/section";
import { Appearance } from "@/components/custom/settings/appearance";
import { Providers } from "@/components/custom/settings/providers";
import { Servers } from "@/components/custom/settings/servers";
import { Connectors } from "@/components/custom/settings/connectors";
import { Toggle } from "@/components/custom/settings/toggle";
import { ErrorLog } from "@/components/custom/settings/error-log";

export default function Settings() {
  const [showToolCalls, setShowToolCalls] = useState(true);

  useEffect(() => {
    getConfig()
      .then((c) => setShowToolCalls(c.showToolCalls))
      .catch(() => {});
  }, []);

  return (
    <Page width="form">
      <PageHeader
        title="Settings"
        description="Your servers, AI provider, and how VibeOps talks to you."
      />

      <Appearance />

      <Section
        title="Assistant"
        description="How much of the agent's work the Assistant shows you."
      >
        <Panel>
          <Toggle
            label="Tool calls"
            detail="Show the per-turn panel of tool calls the agent runs."
            checked={showToolCalls}
            onCheckedChange={(show) => {
              setShowToolCalls(show);
              patchConfig({ showToolCalls: show }).catch(() => {});
            }}
          />
        </Panel>
      </Section>

      <Providers />
      <Servers />

      <Section
        title="Connectors"
        description="The deploy-target CLIs VibeOps can drive on your behalf."
      >
        <Connectors />
      </Section>

      <ErrorLog />
    </Page>
  );
}
