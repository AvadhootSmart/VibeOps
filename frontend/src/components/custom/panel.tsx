import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// A surface, and the hairline-separated row that lives inside it. Every list
// in the app (servers, connectors, toggles, apps) is built from these, so
// radius and padding can't drift. The surface is a bezel: a tinted tray with
// the content plate seated in it, which is what separates it from the page —
// not a heavier border, not a drop shadow. `className` lands on the plate,
// where the content is.

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="bezel">
      <div className={cn("bezel-core overflow-hidden", className)}>
        {children}
      </div>
    </div>
  );
}

export function PanelRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 border-t border-border/70 px-5 py-4 first:border-t-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

// The square-ish tile that carries a row's icon or logo. Squircle rather than
// circle — an app or a machine isn't a person.
export function RowIcon({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-foreground ring-1 ring-foreground/5 ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}
