// Only the fields grouping reads, so this stays free of the Wails bindings
// and runs under bun test.
type Chat = { updated: number };

const DAY = 86_400;

// Buckets by the start of the local day, so "Today" means today and not the
// last 24 hours. `updated` is unix seconds, and the list arrives newest first.
export function groupByRecency<T extends Chat>(chats: T[], now = new Date()) {
  const today = new Date(now).setHours(0, 0, 0, 0) / 1000;
  const groups = [
    { label: "Today", from: today, chats: [] as T[] },
    { label: "Previous 7 days", from: today - 7 * DAY, chats: [] as T[] },
    { label: "Older", from: -Infinity, chats: [] as T[] },
  ];
  for (const chat of chats) {
    groups.find((g) => chat.updated >= g.from)!.chats.push(chat);
  }
  return groups.filter((g) => g.chats.length);
}
