import { HarnessProvider } from "@/components/custom/providers/harness";
import { CLAUDE_MODELS, versionGte } from "@/lib/constants";
import claudeLogo from "../../../../images/claude.png";

// Hoisted so its identity is stable across renders: HarnessProvider's detect
// effect depends on it, and a fresh closure each render would re-run forever.
const claudeModels = (v: string) =>
  CLAUDE_MODELS.filter((m) => v && versionGte(v, m.min));

export function ClaudeCodeProvider(props: {
  active: boolean;
  expanded: boolean;
  onActivate: () => void;
}) {
  return (
    <HarnessProvider
      id="claude-code"
      label="Claude Code"
      logo={claudeLogo}
      // `claude` has no list-models command, so the picker is a static list —
      // version-gated, because a model the installed CLI is too old for would
      // otherwise fail only once a turn was already running.
      models={claudeModels}
      loginHint={
        <>
          Install the <span className="font-mono">claude</span> CLI and sign in
          with <span className="font-mono">claude /login</span> to pick a model.
        </>
      }
      {...props}
    />
  );
}
