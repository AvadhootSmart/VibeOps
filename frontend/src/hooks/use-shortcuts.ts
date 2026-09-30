import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Single source of truth for global keyboard shortcuts. Add one: append an
// entry here — mounting is already handled in App, and the sidebar picks up
// the hint automatically for any route that has a shortcut.
export interface Shortcut {
  key: string; // event.key, lowercase
  path: string;
}

export const SHORTCUTS: Shortcut[] = [
  { key: "j", path: "/assistant" },
  { key: "i", path: "/settings" },
];

export const isMac = navigator.userAgent.includes("Mac");
export const isWindows = navigator.userAgent.includes("Windows");

export function shortcutKey(path: string) {
  return SHORTCUTS.find((s) => s.path === path)?.key.toUpperCase() ?? null;
}

export function useShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const shortcut = SHORTCUTS.find((s) => s.key === event.key.toLowerCase());
      if (!shortcut) return;
      event.preventDefault();
      navigate(shortcut.path);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
}
