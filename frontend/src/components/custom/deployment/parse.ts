export type ServiceKind =
  | "frontend"
  | "api"
  | "worker"
  | "cron"
  | "database"
  | "app";

export interface ServiceProposal {
  name: string;
  kind?: ServiceKind;
  path?: string;
  stack?: string[] | string;
  runs?: string;
  provider: string;
  why?: string;
  alternatives?: string[];
  warning?: string;
}

export interface ProvidersProposal {
  intro?: string;
  services: ServiceProposal[];
}

export type Impact = "safe" | "caution" | "destructive";

export interface PlanStep {
  title: string;
  detail?: string;
  service?: string;
  impact?: Impact;
}

export interface PlanProposal {
  summary?: string;
  steps: PlanStep[];
}

// The schema asks for a list, but a model that has written a thousand READMEs
// will sometimes hand back "TypeScript · Next.js 15" anyway. Split it rather
// than rendering one badge with a separator buried in it.
export function stackList(stack: string[] | string | undefined): string[] {
  const parts = Array.isArray(stack) ? stack : (stack ?? "").split(/[·,|]|\s+\/\s+/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// The tool arguments arrive differently per agent path: the AI-SDK hands them
// over parsed, Claude Code and opencode pass the object straight through, and
// Cursor wraps every MCP call in { toolName, args } — sometimes with args still
// a JSON string. Unwrap all four rather than rendering an empty card.
export function payload<T>(input: unknown): T | null {
  let value = input;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const wrapped = (value as { args?: unknown }).args;
  if (wrapped !== undefined) return payload<T>(wrapped);
  return value as T;
}
