// The app's toggle switch. Hand-rolled rather than pulling in @radix-ui: it's
// a button with aria-checked, and the three places that had each grown their
// own copy only ever differed by accident.
export function Switch({
  checked,
  onCheckedChange,
  label,
  className = "",
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      role="switch"
      type="button"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
        checked ? "bg-primary" : "bg-border"
      } ${className}`}
    >
      <span
        className={`absolute top-[3px] size-4 rounded-full bg-background shadow-sm transition-[left] duration-200 ${
          checked ? "left-[19px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}
