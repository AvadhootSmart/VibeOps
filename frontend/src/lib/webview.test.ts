import { expect, test } from "bun:test";
import { isExternal } from "./webview";

// The click bridge must hand off real links and keep its hands off the
// HashRouter's own URLs.
test("only external links get handed to the OS browser", () => {
  expect(["https://x.dev", "http://x.dev", "mailto:a@b.c"].every(isExternal)).toBe(true);
  expect(["#/write", "/settings", "", "javascript:void(0)"].some(isExternal)).toBe(false);
});
