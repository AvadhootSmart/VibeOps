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
import azureLogo from "../../images/azure.png";
import awsLogo from "../../images/aws.png";
import gcpLogo from "../../images/gcp.png";
import mongodbLogo from "../../images/mongodb.png";

// How each AI provider is drawn — the composer chip and its Settings row.
//
// Cursor is Experimental because its own shell and write tools are denied only
// through a .cursor/cli.json that hasn't been verified against --force
// (backend/tools/harness.go).
export const AI_PROVIDERS: Record<
  Provider,
  { label: string; logo: string; invertOnDark?: boolean; stage?: Stage }
> = {
  openrouter: { label: "OpenRouter", logo: openrouterLogo },
  "claude-code": { label: "Claude Code", logo: claudeLogo },
  cursor: { label: "Cursor", logo: cursorLogo, invertOnDark: true, stage: "experimental" },
  opencode: { label: "Opencode", logo: opencodeLogo, invertOnDark: true },
};

export const experimentalWarning = (label: string) =>
  `${label} runs its own shell and file tools directly on your machine, outside VibeOps' sandbox and approval prompts. VibeOps' own tools are still gated.`;

export const connectorLogos: Record<string, string> = {
  wrangler: cloudflareLogo,
  vercel: vercelLogo,
  neon: neonLogo,
  supabase: supabaseLogo,
  az: azureLogo,
  aws: awsLogo,
  gcloud: gcpLogo,
  atlas: mongodbLogo,
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
  ["azure", azureLogo],
  ["aws", awsLogo],
  ["amazon", awsLogo],
  ["google cloud", gcpLogo],
  ["gcp", gcpLogo],
  ["cloud run", gcpLogo],
  ["mongo", mongodbLogo],
];

export function providerLogo(provider: string): string | undefined {
  const name = provider.toLowerCase();
  return LOGO_KEYWORDS.find(([word]) => name.includes(word))?.[1];
}
