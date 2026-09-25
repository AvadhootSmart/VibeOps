import type { ComponentProps } from "react";
import { type BundledLanguage } from "shiki";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
} from "@/components/ai-elements/code-block";
import { cn } from "@/lib/utils";
import { codeLanguage, textOf } from "./markdown-utils";

// Streamdown marks fenced blocks with data-block; everything else is inline.
export const MarkdownCode = ({
  className,
  children,
  node: _node,
  ...props
}: ComponentProps<"code"> & { node?: unknown }) => {
  if (!("data-block" in props)) {
    return (
      <code
        className={cn(
          "rounded bg-muted px-1.5 py-0.5 font-mono text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  const tag = codeLanguage(className);
  const language = tag as BundledLanguage;

  return (
    <CodeBlock className="my-4" code={textOf(children)} language={language}>
      <CodeBlockHeader>
        <CodeBlockFilename>{tag}</CodeBlockFilename>
        <CodeBlockActions>
          <CodeBlockCopyButton />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  );
};

// Opening is not done here: installWebviewBridges() sends every external
// anchor to the OS browser, so one handler covers links outside markdown too.
export const MarkdownLink = ({
  className,
  node: _node,
  ...props
}: ComponentProps<"a"> & { node?: unknown }) => (
  <a
    className={cn(
      "font-medium text-primary underline underline-offset-2 hover:text-primary/80",
      className,
    )}
    rel="noreferrer"
    target="_blank"
    {...props}
  />
);

// Streamdown's own table ships a wrapper with copy/download/fullscreen
// buttons and a border around a border. Replaced with one bordered, scrollable
// card; cell styling rides along as child selectors so thead/th/td keep
// Streamdown's own components.
export const MarkdownTable = ({
  className,
  node: _node,
  ...props
}: ComponentProps<"table"> & { node?: unknown }) => (
  <div className="my-4 w-full overflow-x-auto rounded-lg border border-border">
    <table
      className={cn(
        "w-full border-collapse text-sm",
        "[&_thead]:bg-muted/50 [&_th]:py-2 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground",
        "[&_tbody]:divide-y-0 [&_tbody_tr:nth-child(even)]:bg-muted/20 [&_td]:align-top",
        className,
      )}
      {...props}
    />
  </div>
);
