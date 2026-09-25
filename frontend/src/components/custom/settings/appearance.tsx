import { useState } from "react";
import { Check, Moon, Sun } from "lucide-react";
import { Section } from "@/components/custom/settings/section";
import { Panel } from "@/components/custom/panel";
import {
  THEMES,
  getTheme,
  getMode,
  setTheme as applyTheme,
  setMode as applyMode,
  type ThemeId,
  type Mode,
} from "@/lib/theme";

// Theme and light/dark mode. Both are applied immediately and persisted by
// lib/theme itself, so this owns nothing but the selected-state highlight.
export function Appearance() {
  const [theme, setThemeState] = useState<ThemeId>(getTheme);
  const [mode, setModeState] = useState<Mode>(getMode);

  return (
    <Section
      title="Appearance"
      description="Each theme brings its own palette and typeface. The choice is saved on this machine."
    >
      <div className="mb-3 grid grid-cols-2 gap-3">
        {THEMES.map((t) => {
          const [surface, ink, accent] = t.swatch;
          const selected = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setThemeState(t.id);
                applyTheme(t.id);
              }}
              aria-pressed={selected}
              className={`group cursor-pointer overflow-hidden rounded-2xl border bg-card text-left transition-[border-color,box-shadow,transform] duration-500 ease-(--ease-spring) hover:border-muted-foreground/40 active:scale-[0.99] ${
                selected ? "border-accent ring-2 ring-accent/25" : ""
              }`}
            >
              {/* A sliver of the theme rather than three loose dots: surface,
                  ink, accent, laid out the way the app lays them out. */}
              <div
                className="relative flex h-14 flex-col justify-center gap-1.5 px-3"
                style={{ background: surface }}
              >
                <span
                  className="block h-1.5 w-3/5 rounded-full"
                  style={{ background: ink }}
                />
                <span
                  className="block h-1.5 w-2/5 rounded-full opacity-40"
                  style={{ background: ink }}
                />
                <span
                  className="absolute right-3 bottom-2.5 size-3.5 rounded-full"
                  style={{ background: accent }}
                />
                {selected && (
                  <span className="absolute top-2 right-2.5 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="border-t px-3 py-2.5">
                <div className="text-item">{t.label}</div>
                <div className="text-meta text-muted-foreground">{t.blurb}</div>
              </div>
            </button>
          );
        })}
      </div>

      <Panel className="flex items-center gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="text-item">Mode</div>
          <div className="text-meta text-muted-foreground">
            Light or dark, within the chosen theme.
          </div>
        </div>
        <div className="ml-auto inline-flex rounded-full border p-0.5">
          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setModeState(m);
                applyMode(m);
              }}
              aria-pressed={mode === m}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-meta capitalize transition-colors ${
                mode === m
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "light" ? (
                <Sun className="size-3.5" />
              ) : (
                <Moon className="size-3.5" />
              )}
              {m}
            </button>
          ))}
        </div>
      </Panel>
    </Section>
  );
}
