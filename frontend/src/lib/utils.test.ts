import { expect, test } from "bun:test";
import { coalesce } from "./utils";

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("coalesce collapses a burst and never drops the final value", async () => {
  const seen: string[] = [];
  const stream = coalesce<string>(20, (v) => seen.push(v));

  stream.push("a");
  stream.push("ab");
  stream.push("abc");
  expect(seen).toEqual([]); // trailing edge: nothing delivered mid-burst
  await tick(40);
  expect(seen).toEqual(["abc"]);

  // A value pushed and immediately finished still lands, exactly once.
  stream.push("abcd");
  stream.flush("abcde");
  expect(seen).toEqual(["abc", "abcde"]);
  await tick(40);
  expect(seen).toEqual(["abc", "abcde"]);

  // flush() with no argument re-delivers whatever was queued.
  stream.push("f");
  stream.flush();
  expect(seen.at(-1)).toBe("f");
});
