import type { Provider } from "@/lib/config";
import type { Stage } from "@/components/custom/stage-badge";
import claudeLogo from "../../images/claude.png";
import cursorLogo from "../../images/cursor.png";
import opencodeLogo from "../../images/opencode.png";
import openrouterLogo from "../../images/openrouter.png";
import cloudflareLogo from "../../images/cloudflare.png";
import vercelLogo from "../../images/vercel.png";
import neonLogo from "../../images/neon.png";
import supabaseLogo from "../../images/supabase.png";

// How each AI provider is drawn — the composer chip and its Settings row.
//
// Cursor is Experimental because its own shell and write tools are denied only
// through a .cursor/cli.json that hasn't been verified against --force
// (backend/tools/harness.go). Claude Code and opencode have theirs switched off
// by a flag or config that was tested, so they are merely Beta.
export const AI_PROVIDERS: Record<
  Provider,
  { label: string; logo: string; invertOnDark?: boolean; stage?: Stage }
> = {
  openrouter: { label: "OpenRouter", logo: openrouterLogo },
  "claude-code": { label: "Claude Code", logo: claudeLogo, stage: "beta" },
  cursor: { label: "Cursor", logo: cursorLogo, invertOnDark: true, stage: "experimental" },
  opencode: { label: "Opencode", logo: opencodeLogo, invertOnDark: true, stage: "beta" },
};

export const experimentalWarning = (label: string) =>
  `${label} runs its own shell and file tools directly on your machine, outside VibeOps' sandbox and approval prompts. VibeOps' own tools are still gated.`;

// Newest connectors, tagged Beta in Settings.
export const BETA_CONNECTORS = ["neon", "supabase"];

export const connectorLogos: Record<string, string> = {
  wrangler: cloudflareLogo,
  vercel: vercelLogo,
  neon: neonLogo,
  supabase: supabaseLogo,
};

// The agent names a provider the way a person would — "Cloudflare Workers",
// "Neon Postgres", "a Vercel project" — never by connector id, so the logo is
// matched on whichever brand word appears in the string. Providers VibeOps has
// no connector for (Fly, Railway, the user's own server) return undefined and
// are drawn as a lettermark instead.
const LOGO_KEYWORDS: [string, string][] = [
  ["cloudflare", cloudflareLogo],
  ["wrangler", cloudflareLogo],
  ["vercel", vercelLogo],
  ["neon", neonLogo],
  ["supabase", supabaseLogo],
];

export function providerLogo(provider: string): string | undefined {
  const name = provider.toLowerCase();
  return LOGO_KEYWORDS.find(([word]) => name.includes(word))?.[1];
}

// Models the `claude` CLI accepts, with the CLI version each needs — the picker
// hides one the installed CLI is too old for, which would otherwise fail only
// once a turn was already running. A min of 2.1.281 is the oldest CLI checked,
// not necessarily the first to ship the model.
export const CLAUDE_MODELS = [
  { id: "claude-fable-5-1", name: "Fable 5.1", min: "2.1.281" },
  { id: "claude-fable-5", name: "Fable 5", min: "2.1.281" },
  { id: "claude-opus-5-5", name: "Opus 5.5", min: "2.1.281" },
  { id: "claude-opus-5", name: "Opus 5", min: "2.1.219" },
  { id: "claude-sonnet-5", name: "Sonnet 5", min: "2.0.0" },
  { id: "claude-opus-4-8", name: "Opus 4.8", min: "2.0.0" },
  { id: "claude-opus-4-7", name: "Opus 4.7", min: "2.1.281" },
  { id: "claude-opus-4-6", name: "Opus 4.6", min: "2.1.281" },
  { id: "claude-sonnet-4-6", name: "Sonnet 4.6", min: "2.1.281" },
  { id: "claude-opus-4-5", name: "Opus 4.5", min: "2.0.0" },
  { id: "claude-sonnet-4-5", name: "Sonnet 4.5", min: "2.0.0" },
  { id: "claude-haiku-4-5", name: "Haiku 4.5", min: "2.0.0" },
  { id: "claude-opus-4-1", name: "Opus 4.1", min: "2.0.0" },
  { id: "claude-opus-4-0", name: "Opus 4", min: "2.0.0" },
  { id: "claude-sonnet-4-0", name: "Sonnet 4", min: "2.0.0" },
];

// Numeric compare on dotted versions; missing components read as 0.
export function versionGte(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}
