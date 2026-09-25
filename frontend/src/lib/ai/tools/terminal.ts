import { Cancel, ShellAccess } from "@wails/go/tools/Tool";
import { defineTool } from "./define";

// $SECRET_ substitution and output redaction happen inside ShellAccess — see
// backend/tools/tools.go, which is the single chokepoint both agent paths use.
export const ShellAccessTool = defineTool<{ script: string }>(
  "shellAccess",
  async ({ script }, { abortSignal }) => {
    const runId = crypto.randomUUID();
    abortSignal?.addEventListener("abort", () => Cancel(runId));
    return ShellAccess(script, runId);
  },
);
