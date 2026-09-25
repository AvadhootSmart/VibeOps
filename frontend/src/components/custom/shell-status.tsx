import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { ShellStatus as GetShellStatus } from "@wails/go/tools/Tool";
import { StageBadge } from "@/components/custom/stage-badge";

// Local commands need WSL plus bubblewrap on Windows, and bubblewrap on Linux.
// Without them ShellAccess refuses to run rather than dropping the sandbox, so
// the agent looks broken for a reason the user can actually fix — this is where
// they find out. Renders nothing on a ready machine, which is every mac.
export function ShellStatus() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    GetShellStatus()
      .then((s) => setMessage(s.ready ? "" : s.message))
      .catch(() => {});
  }, []);

  if (!message) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
      <div className="space-y-1">
        {/* Only renders off macOS, where the shell needs WSL and bubblewrap. */}
        <p className="flex items-center gap-2 font-medium text-foreground">
          Local commands are unavailable
          <StageBadge
            stage="experimental"
            reason="Windows support is experimental: the agent's shell runs inside WSL, and the build is unsigned."
          />
        </p>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
