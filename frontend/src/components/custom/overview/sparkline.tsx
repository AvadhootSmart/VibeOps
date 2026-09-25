export function Sparkline({ d, color }: { d: string; color: string }) {
  return (
    <svg
      className="mt-2.5 h-6 w-full"
      viewBox="0 0 120 24"
      preserveAspectRatio="none"
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
