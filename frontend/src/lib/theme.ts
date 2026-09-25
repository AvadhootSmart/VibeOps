// App appearance: a named theme (palette + fonts, defined in style.css /
// themes/*.style.css) and a light/dark mode. Both live in localStorage — a
// pure UI pref, no keychain/Go round trip needed — and are applied by setting
// `data-theme` and toggling `.dark` on <html>, which the scoped CSS keys off.

// swatch = [surface, primary/ink, accent] — a light-mode preview for the picker.
export const THEMES = [
  {
    id: "graphite",
    label: "Graphite",
    blurb: "Machined neutrals, one roast accent.",
    swatch: ["#FAFAFA", "#15161A", "#E0652E"],
  },
  {
    id: "coffee",
    label: "Coffee",
    blurb: "Warm espresso — the VibeOps original.",
    swatch: ["#F8F4EF", "#36261B", "#E0652E"],
  },
  {
    id: "amber",
    label: "Amber",
    blurb: "Warm minimal — cream, amber, soft edges.",
    swatch: ["#FAF9F5", "#3A3A33", "#CA6A44"],
  },
  {
    id: "zen",
    label: "Zen",
    blurb: "Paper and graphite — quiet, almost colourless.",
    swatch: ["#e9e4d8", "#1e1e1e", "#e0553a"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type Mode = "light" | "dark";

const THEME_KEY = "vibeops.theme";
const MODE_KEY = "vibeops.mode";
const DEFAULT_THEME: ThemeId = "graphite";

export function getTheme(): ThemeId {
  const t = localStorage.getItem(THEME_KEY);
  return THEMES.some((x) => x.id === t) ? (t as ThemeId) : DEFAULT_THEME;
}

export function getMode(): Mode {
  const m = localStorage.getItem(MODE_KEY);
  if (m === "light" || m === "dark") return m;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTheme(theme: ThemeId) {
  localStorage.setItem(THEME_KEY, theme);
  apply();
}

export function setMode(mode: Mode) {
  localStorage.setItem(MODE_KEY, mode);
  apply();
}

// Idempotent — safe to call on boot and on every change.
export function apply() {
  const root = document.documentElement;
  root.dataset.theme = getTheme();
  root.classList.toggle("dark", getMode() === "dark");
}
