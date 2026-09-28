// Free of the Wails bindings (types only) so it runs under bun test.
import type { overview } from "@wails/go/models";

export const CERT_WARN_DAYS = 14;
export const DISK_WARN_PCT = 85;

const DAY = 86_400_000;
const UNITS = [
  ["d", DAY],
  ["h", 3_600_000],
  ["m", 60_000],
] as const;

// How long ago `from` was, as "12d" / "3h" / "5m". Takes an RFC 3339 string or
// unix seconds; "" when unknown, since the snapshot leaves unreadable fields
// empty rather than guessing.
export function age(from: string | number, now = Date.now()) {
  const t = typeof from === "number" ? from * 1000 : Date.parse(from);
  if (!t) return "";
  const ms = Math.max(0, now - t);
  const unit = UNITS.find(([, size]) => ms >= size);
  return unit ? `${Math.floor(ms / unit[1])}${unit[0]}` : "<1m";
}

export function daysUntil(iso: string, now = Date.now()) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((t - now) / DAY);
}

export function certExpiring(app: overview.App, now = Date.now()) {
  const days = daysUntil(app.certExpires, now);
  return days !== null && days < CERT_WARN_DAYS;
}

export function needsAttention(data: overview.Data, now = Date.now()) {
  const apps = data.apps ?? [];
  const hosts = data.hosts ?? [];
  return (
    apps.filter((a) => a.status === "failed" || certExpiring(a, now)).length +
    hosts.filter((h) => h.diskUsedPct >= DISK_WARN_PCT).length
  );
}
