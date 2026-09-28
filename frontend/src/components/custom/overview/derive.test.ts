import { expect, test } from "bun:test";
import type { overview } from "@wails/go/models";
import { age, needsAttention } from "./derive";

const now = Date.parse("2026-09-28T12:00:00Z");

test("age", () => {
  expect(age("2026-09-16T11:00:00Z", now)).toBe("12d");
  expect(age("2026-09-28T09:30:00+00:00", now)).toBe("2h");
  expect(age(now / 1000 - 30, now)).toBe("<1m");
  expect(age("", now)).toBe("");
  expect(age(0, now)).toBe("");
});

test("needsAttention counts failed apps, expiring certs and full disks", () => {
  const app = (status: string, certExpires = "") =>
    ({ status, certExpires }) as overview.App;
  const data = {
    apps: [
      app("running", "2026-12-01T00:00:00Z"),
      app("failed"),
      app("running", "2026-10-03T00:00:00Z"),
      app("running", "2026-09-01T00:00:00Z"),
    ],
    hosts: [{ diskUsedPct: 91 }, { diskUsedPct: 40 }],
  } as overview.Data;
  expect(needsAttention(data, now)).toBe(4);
});
