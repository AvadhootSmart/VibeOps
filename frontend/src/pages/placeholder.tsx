import type { LucideIcon } from "lucide-react";

// Quiet stand-in for screens that aren't built yet. Keeps the nav honest
// without pretending features exist.
export default function PagePlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="grid h-full min-h-[68vh] place-items-center px-8">
      <div className="rise-stagger max-w-sm text-center">
        <div className="bezel mx-auto mb-6 w-fit">
          <div className="bezel-core grid size-12 place-items-center text-muted-foreground">
            <Icon className="size-5" />
          </div>
        </div>
        <h1 className="text-title">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <p className="mx-auto mt-6 w-fit rounded-full bg-secondary px-3 py-1 text-micro text-muted-foreground">
          Not built yet
        </p>
      </div>
    </div>
  );
}
