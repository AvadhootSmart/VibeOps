import { expect, test } from "bun:test";
import { codeLanguage, textOf } from "./markdown-utils";

test("fence tags fall back to text when shiki cannot load them", () => {
  expect(codeLanguage("language-ts")).toBe("ts");
  expect(codeLanguage("language-notalang")).toBe("text");
  expect(codeLanguage(undefined)).toBe("text");
});

test("code text survives the element streamdown wraps it in", () => {
  expect(textOf({ props: { children: ["const ", "x = 1"] } } as never)).toBe(
    "const x = 1",
  );
});
