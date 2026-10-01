import { HarnessProvider } from "@/components/custom/providers/harness";
import claudeLogo from "../../../../images/claude.png";

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
