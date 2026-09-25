import { useEffect, useState } from "react";
import { onSecretPrompt, SUDO_SECRET } from "@/lib/ai";
import { EventsOn } from "@wails/runtime/runtime";
import { ResolveSecret } from "@wails/go/tools/Harness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifyIfAway } from "@/lib/notify";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Collects a secret the agent needs but must never see: the sudo password, or
// any named value (DATABASE_URL, API tokens) requested via secretRequest.
// Whatever the user types goes to the tool bridge, which substitutes it into
// the command at execution time; cancelling resolves null so the command is
// skipped. The value lives only in this component's state for the moment it's
// being submitted. See docs/secret-request-flow.md.
interface Pending {
  name: string;
  reason: string;
  resolve: (value: string | null) => void;
}

export function SecretDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState("");

  // OpenRouter path: the tools run in the frontend and resolve in-memory.
  useEffect(
    () =>
      onSecretPrompt((name, reason, resolve) =>
        setPending({ name, reason, resolve }),
      ),
    [],
  );

  // Claude Code path: the tool runs in the `vibeops mcp` child, which asks the
  // app over a file; Go emits "secret:request" and the answer goes back via the
  // ResolveSecret binding (keychain).
  useEffect(
    () =>
      EventsOn("secret:request", (name: string, reason: string) =>
        setPending({
          name,
          reason,
          resolve: (v) => ResolveSecret(name, v ?? ""),
        }),
      ),
    [],
  );

  function finish(value: string | null) {
    pending?.resolve(value);
    setPending(null);
    setValue("");
  }

  const isSudo = pending?.name === SUDO_SECRET;
  const title = isSudo ? "Sudo password required" : `${pending?.name} required`;

  useEffect(() => {
    if (pending) notifyIfAway(title, pending.reason);
  }, [pending]);

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) finish(null); // cancel / Esc / click-away = skip command
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {title}
          </DialogTitle>
          <DialogDescription>
            {isSudo
              ? "The agent wants to run a command as root:"
              : "The agent needs this value but never sees it — VibeOps substitutes it when the command runs."}
            <code className="mt-2 block break-all rounded bg-muted px-2 py-1 text-xs">
              {pending?.reason}
            </code>
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            finish(value);
          }}
        >
          <Input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            placeholder={isSudo ? "Sudo password" : pending?.name}
          />
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => finish(null)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!value}>
              {isSudo ? "Run" : "Provide"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
