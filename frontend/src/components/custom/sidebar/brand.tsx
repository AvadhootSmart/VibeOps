import logo from "../../../../images/logo-mark.png";
import { isMac } from "@/hooks/use-shortcuts";
import { StageBadge } from "@/components/custom/stage-badge";

// On macOS the traffic lights own the top strip, so the brand sits on its own
// row beneath them instead of squeezing in beside them. The strip matches the
// pane's title bar, keeping the lights and the sidebar toggle on one line.
export function SidebarBrand() {
  return (
    <div
      className={`[-webkit-app-region:drag] ${isMac ? "pt-11" : "pt-1"}`}
    >
      <div className="flex h-11 select-none items-center gap-2.5 px-2">
        {/* The app icon, not a letter in the header: the mark gets its own
            accent tile so it reads as an object, and the name beside it stays
            plain ink. The glyph is black and every theme's accent-foreground
            is near-black, so it needs no inverting in either mode. */}
        <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent bg-[linear-gradient(180deg,rgb(255_255_255/0.22),transparent_60%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_0_0_1px_color-mix(in_oklab,var(--accent)_70%,black),0_4px_12px_-6px_var(--accent)]">
          <img src={logo} alt="" className="size-5 object-contain" />
        </span>
        <span className="text-section font-semibold tracking-[-0.025em]">
          VibeOps
        </span>
        <StageBadge stage="beta" />
      </div>
    </div>
  );
}
