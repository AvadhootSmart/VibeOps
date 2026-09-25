import { Get, Set } from "@wails/go/settings/Settings";
import { settings } from "@wails/go/models";

// config.json crosses the bridge whole (backend/settings). This is the only
// place that interprets it: defaults, and the read-modify-write for a partial
// update.
//
// ponytail: patch() is read-then-write across the bridge, so two writes racing
// would lose one. Settings changes are user-driven in a single window; move the
// merge into Go if that stops being true.

/** Providers backed by a local coding-agent CLI rather than an API key. Order
 * is the order the settings accordion lists them in. */
export const HARNESSES = ["claude-code", "cursor", "opencode"] as const;

export type Harness = (typeof HARNESSES)[number];
export type Provider = "openrouter" | Harness;

const isHarness = (p: string): p is Harness =>
  (HARNESSES as readonly string[]).includes(p);

export interface Config {
  model: string;
  /** --model per harness CLI, keyed by provider id. Empty = the CLI's default. */
  agentModels: Record<string, string>;
  provider: Provider;
  servers: settings.Server[];
  showToolCalls: boolean;
  /** Experimental providers whose warning the user has accepted. */
  experimentalAck: string[];
}

function withDefaults(c: settings.Config): Config {
  return {
    model: c.model ?? "",
    agentModels: c.agentModels ?? {},
    provider: isHarness(c.provider) ? c.provider : "openrouter",
    servers: c.servers ?? [],
    // Stored inverted so the zero value (nothing written yet) means "shown".
    showToolCalls: !c.hideToolCalls,
    experimentalAck: c.experimentalAck ?? [],
  };
}

export async function getConfig(): Promise<Config> {
  return withDefaults(await Get());
}

export async function patchConfig(patch: Partial<Config>): Promise<void> {
  const current = await Get();
  const { showToolCalls, ...rest } = patch;
  await Set(
    settings.Config.createFrom({
      ...current,
      ...rest,
      ...(showToolCalls === undefined ? {} : { hideToolCalls: !showToolCalls }),
    }),
  );
}

/** Sets one harness's model without clobbering the others. */
export async function setAgentModel(agent: Harness, model: string) {
  const { agentModels } = await getConfig();
  await patchConfig({ agentModels: { ...agentModels, [agent]: model } });
}
