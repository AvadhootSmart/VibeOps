import type { ReactNode } from "react";
import { bundledLanguages } from "shiki";

export const textOf = (children: ReactNode): string => {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(textOf).join("");
  const props = (children as { props?: { children?: ReactNode } })?.props;
  return props ? textOf(props.children) : "";
};

// Unknown fence tags would make shiki throw on every render, so they degrade
// to plain text.
export const codeLanguage = (className?: string) => {
  const tag = /language-([\w-]+)/.exec(className ?? "")?.[1] ?? "text";
  return tag in bundledLanguages ? tag : "text";
};
