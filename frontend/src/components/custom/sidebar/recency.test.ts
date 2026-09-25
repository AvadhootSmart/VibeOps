import { expect, test } from "bun:test";
import { groupByRecency } from "./recency";

test("groups chats by local day, dropping empty groups", () => {
  const now = new Date(2026, 8, 25, 15, 0);
  const at = (d: Date) => ({ id: String(+d), name: "", updated: +d / 1000 });
  const groups = groupByRecency(
    [
      at(new Date(2026, 8, 25, 0, 5)),
      at(new Date(2026, 8, 24, 23, 59)),
      at(new Date(2026, 8, 1)),
    ],
    now,
  );
  expect(groups.map((g) => [g.label, g.chats.length])).toEqual([
    ["Today", 1],
    ["Previous 7 days", 1],
    ["Older", 1],
  ]);
});
