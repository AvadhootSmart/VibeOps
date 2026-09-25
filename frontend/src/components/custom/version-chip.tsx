import { useEffect, useState } from "react";
import { Version } from "@wails/go/main/App";
import { BrowserOpenURL } from "@wails/runtime/runtime";

// A quiet line at the foot of the sidebar. Up to date, it is metadata and
// styled like it; an available update is the one state worth clicking, so
// that one gets the accent and nothing else does.
export function VersionChip() {
  const [version, setVersion] = useState({ current: "", latest: "" });

  useEffect(() => {
    Version()
      .then(setVersion)
      .catch(() => {});
  }, []);

  if (!version.current) return null;

  if (version.latest && version.latest !== version.current) {
    return (
      <button
        onClick={() => BrowserOpenURL("https://getvibeops.in")}
        className="flex w-full items-center gap-2 rounded-md py-1 text-meta text-accent transition-opacity hover:opacity-80"
      >
        <span className="size-1.5 shrink-0 rounded-full bg-accent" />
        <span className="truncate">Update to v{version.latest}</span>
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
