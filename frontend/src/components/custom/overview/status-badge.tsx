export type AppStatus = "running" | "deploying" | "failed";

const STATUS_STYLES: Record<AppStatus, { label: string; className: string }> = {
  running: { label: "Running", className: "bg-ok-soft text-ok" },
  deploying: { label: "Deploying", className: "bg-info-soft text-info" },
  failed: { label: "Failed", className: "bg-err-soft text-err" },
};

export function StatusBadge({ status }: { status: AppStatus }) {
  // The snapshot is written by the model, so an unlisted status is a matter of
  // time. Show it rather than crashing the whole table over one row.
  const s = STATUS_STYLES[status] ?? {
    label: status || "Unknown",
    className: "bg-secondary text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-meta font-medium capitalize ${s.className}`}
    >
      <span className="size-[6px] rounded-full bg-current" />
      {s.label}
    </span>
  );
}
