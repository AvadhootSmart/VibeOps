import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The shell every screen sits in. It owns the two things that used to drift
// per page — how wide the column is, and what a page header looks like — so a
// new screen inherits the rhythm instead of re-inventing it.

// Reading measure, not screen size: a settings form wants a narrower column
// than a table of applications, and prose narrower still.
const WIDTHS = {
  wide: "max-w-[1080px]", // tables, dashboards
  form: "max-w-[680px]", // settings, single-column forms
  prose: "max-w-3xl", // the chat transcript
} as const;

export function Page({
  width = "wide",
  className,
  children,
}: {
  width?: keyof typeof WIDTHS;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        // Bottom runs deeper than the top: content ending flush against the
        // window edge reads as clipped. Direct children rise in on mount.
        "rise-stagger mx-auto w-full px-4 pt-4 pb-16 md:px-10 md:pt-6",
        WIDTHS[width],
        className,
      )}
    >
      {children}
    </div>
  );
}

// Title, one line of context, and at most one primary action. `adornment` is
// for controls that belong *to the title* rather than to the page (the
// overview's refresh), so they sit on the baseline instead of next to the CTA.
export function PageHeader({
  title,
  description,
  adornment,
  actions,
}: {
  title: string;
  description?: ReactNode;
  adornment?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-title">{title}</h1>
          {adornment}
        </div>
        {description && (
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
