import type { ReactNode } from "react";

// Section with the prototype's hairline-separated anatomy: title, one-line
// context, then content. Space and hairlines do the separating — no boxes
// within boxes.
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t py-8 first:border-t-0 first:pt-0">
      <h2 className="text-section">{title}</h2>
      <p className="mt-1 mb-5 max-w-prose text-meta text-muted-foreground">
        {description}
      </p>
      {children}
    </section>
  );
}
