import { Minus, Square, X } from "lucide-react";
import {
  Quit,
  WindowMinimise,
  WindowToggleMaximise,
} from "@wails/runtime/runtime";

// The Windows caption buttons: the window is frameless there (main.go), so the
// app draws them in its own title bar.
const BUTTON =
  "grid h-11 w-11 place-items-center text-muted-foreground hover:bg-foreground/8 hover:text-foreground";

export function WindowControls() {
  return (
    <div className="-mr-2.5 ml-auto flex [--wails-draggable:no-drag]">
      <button className={BUTTON} onClick={WindowMinimise} aria-label="Minimise">
        <Minus className="size-4" />
      </button>
      <button
        className={BUTTON}
        onClick={WindowToggleMaximise}
        aria-label="Maximise"
      >
        <Square className="size-3.5" />
      </button>
      <button
        className={`${BUTTON} hover:bg-destructive hover:text-white`}
        onClick={Quit}
        aria-label="Close"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
