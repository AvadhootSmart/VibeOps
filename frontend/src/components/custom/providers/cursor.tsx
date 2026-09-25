import { HarnessProvider } from "@/components/custom/providers/harness";
import cursorLogo from "../../../../images/cursor.png";

export function CursorProvider(props: {
  active: boolean;
  expanded: boolean;
  onActivate: () => void;
}) {
  return (
    <HarnessProvider
      id="cursor"
      label="Cursor"
      logo={cursorLogo}
      invertOnDark
      loginHint={
        <>
          Install the <span className="font-mono">cursor-agent</span> CLI and
          sign in with <span className="font-mono">cursor-agent login</span> to
          pick a model.
        </>
      }
      {...props}
    />
  );
}
