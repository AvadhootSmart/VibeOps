import { HarnessProvider } from "@/components/custom/providers/harness";
import opencodeLogo from "../../../../images/opencode.png";

export function OpencodeProvider(props: {
  active: boolean;
  expanded: boolean;
  onActivate: () => void;
}) {
  return (
    <HarnessProvider
      id="opencode"
      label="Opencode"
      logo={opencodeLogo}
      invertOnDark
      loginHint={
        <>
          Install the <span className="font-mono">opencode</span> CLI and add a
          provider with <span className="font-mono">opencode auth login</span>{" "}
          to pick a model.
        </>
      }
      {...props}
    />
  );
}
