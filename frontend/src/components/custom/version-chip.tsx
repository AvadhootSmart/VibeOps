import { useEffect, useState } from "react";
import { Restart, Update, Version } from "@wails/go/main/App";
import { BrowserOpenURL } from "@wails/runtime/runtime";
import { notifyError } from "@/lib/notify";

type Stage = "available" | "downloading" | "ready" | "failed";

const LABEL: Record<Stage, (latest: string) => string> = {
  available: (v) => `Update to v${v}`,
  downloading: () => "Downloading update…",
  ready: () => "Restart to apply update",
  failed: () => "Update failed · download manually",
};

// A quiet line at the foot of the sidebar. Up to date, it is metadata and
// styled like it; an available update is the one state worth clicking, so
// that one gets the accent and nothing else does.
export function VersionChip() {
  const [version, setVersion] = useState({ current: "", latest: "" });
  const [stage, setStage] = useState<Stage>("available");

  useEffect(() => {
    Version()
      .then(setVersion)
      .catch(() => {});
  }, []);

  if (!version.current) return null;

  const onClick = () => {
    if (stage === "available") {
      setStage("downloading");
      Update()
        .then(() => setStage("ready"))
        .catch((err) => {
          notifyError("Update failed", err);
          setStage("failed");
        });
    } else if (stage === "ready") {
      Restart().catch((err) => {
        notifyError("Restart failed", err);
        setStage("failed");
      });
    } else if (stage === "failed") {
      BrowserOpenURL("https://getvibeops.in");
    }
  };

  if (version.latest && version.latest !== version.current) {
    return (
      <button
        onClick={onClick}
        disabled={stage === "downloading"}
        title={stage === "failed" ? "Opens getvibeops.in" : undefined}
        className="flex w-full items-center gap-2 rounded-md py-1 text-meta text-accent transition-opacity hover:opacity-80 disabled:animate-pulse disabled:hover:opacity-100"
      >
        <span className="size-1.5 shrink-0 rounded-full bg-accent" />
        <span className="truncate">{LABEL[stage](version.latest)}</span>
      </button>
    );
  }

  return (
    <p className="flex items-center gap-2 py-1 text-meta text-muted-foreground/70">
      <span className="size-1.5 shrink-0 rounded-full bg-ok" />
      Version {version.current} · Beta
    </p>
  );
}
