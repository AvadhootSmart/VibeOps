import { providerLogo } from "@/lib/constants";

// A provider's face, at one of two sizes. Falls back to a lettermark so a
// target VibeOps has no connector for — Fly, Railway, the user's own box —
// still reads as a distinct destination rather than a hole in the row.
export function ProviderMark({
  provider,
  size = "md",
  className = "",
}: {
  provider: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const logo = providerLogo(provider);
  const box = size === "sm" ? "size-6" : "size-9";

  if (!logo)
    return (
      <span
        title={provider}
        className={`${box} grid shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground uppercase ${className}`}
      >
        {provider.trim().charAt(0)}
      </span>
    );

  return (
    <img
      src={logo}
      alt={provider}
      title={provider}
      className={`${box} shrink-0 rounded-lg object-contain ${className}`}
    />
  );
}
