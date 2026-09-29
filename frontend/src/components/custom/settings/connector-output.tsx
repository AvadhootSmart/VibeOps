// What a connector's CLI is printing while it runs. A login can print a code
// the user must type into the browser (Atlas), or a URL it couldn't open
// itself (anything inside WSL) — both are useless once the command has ended,
// so they're shown live under the row. URLs are links; the webview bridge
// sends them to the OS browser.
const URL_PATTERN = /(https?:\/\/[^\s"'<>]+)/g;

export function ConnectorOutput({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <pre className="basis-full overflow-x-auto rounded-md bg-muted/60 px-3 py-2 font-mono text-meta whitespace-pre-wrap break-all text-muted-foreground">
      {lines.map((line, i) => (
        <div key={i}>
          {line.split(URL_PATTERN).map((part, j) =>
            j % 2 === 1 ? (
              <a
                key={j}
                href={part}
                className="text-foreground underline underline-offset-2"
              >
                {part}
              </a>
            ) : (
              part
            ),
          )}
        </div>
      ))}
    </pre>
  );
}
