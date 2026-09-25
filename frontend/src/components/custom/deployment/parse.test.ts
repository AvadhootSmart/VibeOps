import { expect, test } from "bun:test";
import { payload, stackList } from "./parse";

// Four agent paths, four shapes of the same call. A card that silently renders
// nothing because Cursor wrapped the arguments is the failure this guards.
test("tool arguments unwrap whatever the agent path wrapped them in", () => {
  const plan = { summary: "ship it", steps: [{ title: "deploy", impact: "safe" }] };
  expect(payload(plan)).toEqual(plan);
  expect(payload(JSON.stringify(plan))).toEqual(plan);
  expect(payload({ toolName: "proposePlan", args: plan })).toEqual(plan);
  expect(payload({ toolName: "proposePlan", args: JSON.stringify(plan) })).toEqual(plan);
});

test("unparseable arguments render nothing rather than throwing", () => {
  expect(payload("not json")).toBe(null);
  expect(payload(undefined)).toBe(null);
});

test("a stack reaches the badge row as separate entries either way", () => {
  expect(stackList(["Go 1.23", "chi"])).toEqual(["Go 1.23", "chi"]);
  expect(stackList("Node 22 \u00b7 ffmpeg")).toEqual(["Node 22", "ffmpeg"]);
  expect(stackList("TypeScript, Next.js 15")).toEqual(["TypeScript", "Next.js 15"]);
  expect(stackList(undefined)).toEqual([]);
});
