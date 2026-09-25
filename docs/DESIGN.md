---
version: alpha
name: VibeOps
description: Calm, confident, typography-driven self-hosting platform — Linear/Vercel minimalism with a warm coffee palette. Light mode, single roast-orange accent, espresso ink.

# ─────────────────────────────────────────────────────────────
# Foundation colors (raw palette)
# ─────────────────────────────────────────────────────────────
colors:
  # Neutrals — the "coffee + milk" canvas
  latte: "#F8F4EF"        # app background (milk-white, warm)
  foam: "#FFFDFB"         # cards / raised surfaces
  espresso: "#2A1C12"     # primary ink / near-black text
  cocoa: "#36261B"        # primary brand (buttons, solid fills)
  mocha: "#6F5F50"        # muted / secondary text
  crema: "#EFE7DC"        # subtle fills, secondary buttons, code wells
  rim: "#E9DFD3"          # hairline borders, inputs, dividers

  # Accent — the single bold color
  roast: "#E0652E"        # roast orange — links, active, focus, key CTAs, AI accent
  roast-soft: "#FBEADE"   # tinted accent background (badges, highlights)

  # Semantics — status only, never decoration
  ok: "#3F8C5E"           # healthy / running / deployed
  ok-soft: "#E4F0E8"
  warn: "#B8780F"         # warning / degraded
  warn-soft: "#F6ECD6"
  err: "#C0392B"          # error / failed / crashed
  err-soft: "#F7E2DF"
  info: "#3F6FA8"         # deploying / building / info
  info-soft: "#E2EAF3"

  # On-color text
  on-cocoa: "#F7F1E9"     # text on espresso/cocoa fills
  on-roast: "#2A1C12"     # near-black text on orange fills (AA); white only for large text

# ─────────────────────────────────────────────────────────────
# shadcn / Tailwind v4 token mapping
# Drop these into globals.css @theme / :root. This is the
# canonical mapping — re-theme shadcn primitives, don't fork them.
# ─────────────────────────────────────────────────────────────
shadcn:
  background: "{colors.latte}"
  foreground: "{colors.espresso}"
  card: "{colors.foam}"
  card-foreground: "{colors.espresso}"
  popover: "{colors.foam}"
  popover-foreground: "{colors.espresso}"
  primary: "{colors.cocoa}"
  primary-foreground: "{colors.on-cocoa}"
  secondary: "{colors.crema}"
  secondary-foreground: "{colors.espresso}"
  muted: "{colors.crema}"
  muted-foreground: "{colors.mocha}"
  accent: "{colors.roast}"
  accent-foreground: "{colors.on-roast}"
  destructive: "{colors.err}"
  destructive-foreground: "#FFFFFF"
  border: "{colors.rim}"
  input: "{colors.rim}"
  ring: "{colors.roast}"
  radius: "0.5rem"

# ─────────────────────────────────────────────────────────────
# Typography — Space Grotesk (UI) + Geist Mono (logs/code only)
# Numerals stay sans, with tabular figures.
# ─────────────────────────────────────────────────────────────
typography:
  display-xl:  { fontFamily: "Space Grotesk", fontSize: "56px", fontWeight: 600, lineHeight: "1.05", letterSpacing: "-0.03em" }
  display-lg:  { fontFamily: "Space Grotesk", fontSize: "40px", fontWeight: 600, lineHeight: "1.08", letterSpacing: "-0.025em" }
  h1:          { fontFamily: "Space Grotesk", fontSize: "28px", fontWeight: 600, lineHeight: "1.15", letterSpacing: "-0.02em" }
  h2:          { fontFamily: "Space Grotesk", fontSize: "20px", fontWeight: 600, lineHeight: "1.25", letterSpacing: "-0.015em" }
  h3:          { fontFamily: "Space Grotesk", fontSize: "16px", fontWeight: 600, lineHeight: "1.3",  letterSpacing: "-0.01em" }
  body-lg:     { fontFamily: "Space Grotesk", fontSize: "17px", fontWeight: 400, lineHeight: "1.6",  letterSpacing: "0" }
  body-md:     { fontFamily: "Space Grotesk", fontSize: "15px", fontWeight: 400, lineHeight: "1.55", letterSpacing: "0" }
  body-sm:     { fontFamily: "Space Grotesk", fontSize: "13px", fontWeight: 400, lineHeight: "1.5",  letterSpacing: "0" }
  label:       { fontFamily: "Space Grotesk", fontSize: "13px", fontWeight: 500, lineHeight: "1.2",  letterSpacing: "0" }
  metric:      { fontFamily: "Space Grotesk", fontSize: "32px", fontWeight: 600, lineHeight: "1.0",  letterSpacing: "-0.02em", fontFeatureSettings: "'tnum'" }
  mono:        { fontFamily: "Geist Mono", fontSize: "13px", fontWeight: 400, lineHeight: "1.6", letterSpacing: "0" }

# ─────────────────────────────────────────────────────────────
# Spacing — spacious, 4px base. Spacing IS the UI driver.
# ─────────────────────────────────────────────────────────────
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  3xl: 96px

rounded:
  sm: 6px
  md: 8px      # default — matches shadcn --radius 0.5rem
  lg: 12px
  xl: 16px
  full: 9999px

# ─────────────────────────────────────────────────────────────
# Component theming hints (re-theme shadcn, don't build new)
# ─────────────────────────────────────────────────────────────
components:
  button-primary:
    backgroundColor: "{colors.cocoa}"
    textColor: "{colors.on-cocoa}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-accent:
    backgroundColor: "{colors.roast}"
    textColor: "{colors.on-roast}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.espresso}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  input:
    backgroundColor: "{colors.foam}"
    textColor: "{colors.espresso}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  card:
    backgroundColor: "{colors.foam}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

## Overview

VibeOps is an AI DevOps platform: you give it a Git repo and a domain, it deploys and operates the app. The UI has to make infrastructure feel **calm and legible** to people who don't know (or want to know) DevOps — while still earning the trust of developers who do.

**Mood:** sleek, UX-focused, confident. The reference points are Linear and Vercel — minimalism, obsessive spacing, restraint — but warmed up with a **coffee palette** so it feels human and inviting rather than cold and corporate.

**The one job:** make infrastructure feel *understood*. Every screen should read like a calm explanation, not a control panel.

**Mode:** Light only (for now). Single accent. Typography and whitespace do the work — not color, not borders, not shadows.

**Implementation note:** Components are **shadcn primitives, re-themed** via the `shadcn:` token map in the front matter. Pull components with the shadcn CLI and override the CSS variables — do not hand-roll bespoke components or fork shadcn internals. Compose screens from themed primitives.

## Colors

A "coffee with milk" system: a warm latte canvas, espresso ink, and exactly one bold accent — **roast orange (#E0652E)**.

- **Latte `#F8F4EF`** — app background. Everything sits on this warm milk-white.
- **Foam `#FFFDFB`** — cards and raised surfaces. Barely lighter than latte; separation comes from a hairline, not a shadow.
- **Espresso `#2A1C12`** — primary text and near-black.
- **Cocoa `#36261B`** — primary brand fill (default buttons, solid actions). High-contrast, quiet, premium.
- **Mocha `#6F5F50`** — secondary/muted text, captions, metadata.
- **Crema `#EFE7DC`** / **Rim `#E9DFD3`** — subtle fills and hairline borders.
- **Roast `#E0652E`** — the *single* accent. Links, active nav, focus rings, AI moments, and the one CTA per screen that matters most. Use it sparingly; orange loud is orange ignored.

**Semantic colors are for status only — never decoration.** Each pairs a saturated foreground with a soft tint background for badges:

| State | Color | Use |
|---|---|---|
| OK / Running / Deployed | `#3F8C5E` on `#E4F0E8` | healthy services |
| Warning / Degraded | `#B8780F` on `#F6ECD6` | needs attention |
| Error / Failed / Crashed | `#C0392B` on `#F7E2DF` | broken state |
| Deploying / Building / Info | `#3F6FA8` on `#E2EAF3` | in-progress, neutral info |

**Accent text contrast:** orange fills (`#E0652E`) use **near-black text** (`#2A1C12`) to hold AA. White-on-orange is allowed only for large/display text.

## Typography

**Space Grotesk** for everything UI; **Geist Mono** for logs, code, container IDs, and repo paths only. Both load via `@fontsource` in the app (`frontend/src/style.css`); Google Fonts is fine for standalone pages. Tight negative tracking on headings is the Linear/Vercel signature — keep it.

- Headings (`h1`/`h2`/`display`) carry the design. Generous size jumps, tight letter-spacing, weight 600.
- Body is 15–17px, line-height 1.55–1.6, never cramped.
- **Numerals are sans** (Space Grotesk) with **tabular figures** (`font-feature-settings: 'tnum'`) so metrics, percentages, and timestamps align in columns. The `metric` style is for the big KPI numbers.
- **Geist Mono** appears *only* where text is literally code/machine output. Don't use mono for labels or numbers just to look "technical."

## Layout

**Spacing is the primary UI driver.** Before reaching for a border or a background fill to separate things, reach for space. 4px base scale; lean on `lg` (24) and `xl` (40) generously.

- **Topbar nav, minimal.** A single slim top bar: wordmark left, primary nav center/left, environment + account right. No left sidebar — the spacious canvas is the point. Secondary nav (within an app) is a quiet horizontal tab row under a page header.
- **Content max-width** ~1080–1200px, centered, with real breathing room in the gutters. Don't span full-bleed dashboards.
- **Page anatomy:** page header (h1 + one-line context + primary action) → content sections separated by `xl` space and the occasional hairline, never by boxes-within-boxes.
- One screen, one clear primary action. Everything else is quieter.

## Elevation & Depth

**Hairlines, not shadows.** Separation comes from `1px` Rim (`#E9DFD3`) borders and the subtle Foam/Latte surface shift. At most one barely-there shadow on a floating popover/menu (`0 4px 16px rgba(42,28,18,0.06)`). No card drop-shadows, no layered elevation, no glassmorphism.

## Shapes

Rounded, calm, consistent. `rounded-md` (8px / shadcn `--radius: 0.5rem`) is the default for buttons, inputs, and small elements; `lg` (12px) for cards and wells; `full` for badges, pills, and avatars. Nothing sharp-cornered, nothing pill-everything.

## Components

Use **shadcn primitives re-themed** with the token map. Composition rules:

- **Buttons** — default = Cocoa solid (`button-primary`). The *one* hero CTA per screen may be Roast (`button-accent`). Everything secondary is ghost/outline. Never two accent buttons on one screen.
- **Cards** — Foam fill, `lg` radius, hairline border, generous `lg`/`xl` padding. Status lives in a pill badge, not a colored card border.
- **Status badges** — soft-tint pill + saturated label text, from the semantic table. Always pair a dot or label with color (don't rely on hue alone).
- **Inputs** — Foam fill, Rim border, Roast focus ring. Roomy padding.
- **Metric tiles** — big `metric` number (tabular), a quiet Mocha label above, optional tiny sparkline. No chartjunk.
- **Log stream** — Geist Mono on a Crema/Foam well; the **AI summary sits above the raw logs** as the headline, raw lines collapsed/secondary. The AI summary is where Roast and plain-language copy shine.
- **AI / incident** — the AI's voice gets a subtle Roast accent (a thin left rule, a small mark, or roast-soft background) so users learn "orange = VibeOps is talking to me." Diagnosis cards read like a sentence: what happened → why → what to do.

## Voice & tone

**Lean and layman.** The AI explains infrastructure the way a calm senior engineer would to a friend who isn't technical.

- Say "Your app ran out of memory," not "OOMKilled (exit 137)." Offer the raw detail underneath for those who want it.
- Short sentences. Plain words. No jargon in the headline; jargon allowed in the collapsed detail.
- Action-oriented: every problem statement is followed by what to do about it.
- Never alarmist. Calm even when reporting a crash.

## Do's and Don'ts

**Do**
- Let whitespace separate content before borders, and borders before fills.
- Keep one accent (roast) and one primary action per screen.
- Use semantic colors strictly for state; pair color with a label/dot.
- Use tabular sans numerals for all metrics and timestamps.
- Write headlines in plain language; tuck the technical detail underneath.

**Don't**
- ❌ No dense, AWS-console-style tables or cramped multi-panel dashboards.
- ❌ No drop shadows on cards, no glassmorphism, no layered elevation.
- ❌ No gradients — the only exception is a single soft atmospheric wash behind the landing hero (latte → faint roast-soft), nowhere else.
- ❌ No colors outside the coffee palette + the four semantics. No purple, no teal, no neon.
- ❌ No mono font for labels or plain numbers — mono is for actual machine output only.
- ❌ No more than one Roast button per screen; don't let orange become the background color.
- ❌ No raw error codes as headlines (`exit 137`, `ECONNREFUSED`) — explain first, expose the code second.
</content>
</invoke>

## Implementation: the app's shared pieces

The prose above is the intent. These are the four things in the code that hold
it together — reach for them before writing a new class list.

**Type scale (`frontend/src/style.css`).** Six sizes, each carrying its own
line-height, tracking and weight, so a heading is one class:

| Class | Size | For |
|---|---|---|
| `text-title` | 21px / 600 | the page title — exactly one per screen |
| `text-section` | 15px / 600 | a section or group heading |
| `text-metric` | 28px / 600 | a KPI number (tabular by default) |
| `text-item` | 14px / 500 | a row or list-item label |
| `text-meta` | 13px | the quiet second line under an item |
| `text-micro` | 11px | chips and tags, the smallest step there is |
| `eyebrow` | 11px / 600 / uppercase | the small label above a card or column |

An arbitrary size (`text-[13.5px]`) is a bug — add to the scale or use it.

**`<Page>` / `<PageHeader>` (`components/custom/page.tsx`).** Owns the column
width (`wide` for tables, `form` for settings, `prose` for chat) and the
gutters. A screen's header is a `<PageHeader>`, never hand-rolled markup.

**`<Panel>` / `<PanelRow>` / `<RowIcon>` (`components/custom/panel.tsx`).** The
bordered surface and its hairline-separated rows — every list in the app
(servers, connectors, toggles, applications) is built from these, so padding
and radius can't drift between screens.

**Radius follows the theme.** `rounded-xl` for panels, `rounded-lg` for inner
tiles, `rounded-md` for controls, `rounded-full` for pills. All derive from
`--radius`, so a theme that wants softer corners gets them; a hardcoded
`rounded-[13px]` silently opts out.

**Themes are scoped.** Every theme file is `:root[data-theme="<id>"]` and
`:root[data-theme="<id>"].dark`, and carries a palette only — no Tailwind
import, no `@theme`, no base layer. An unscoped tweakcn export leaks its
palette and its letter-spacing into every other theme.

## v2 surfaces (supersedes the elevation and typography notes above)

**Graphite is the default theme** (`themes/graphite.style.css`): cool neutrals,
roast kept as the only accent, Geist + Geist Mono. No serif fonts in any theme.

**The window is a canvas with a plate on it.** The sidebar uses shadcn's
`inset` variant: `--sidebar` is the canvas, `--background` is the rounded pane
seated on it. The active nav row is cut from the same plate.

**Surfaces are bezels, not borders.** `bezel` (tinted tray + hairline) wraps
`bezel-core` (the content plate, inner highlight). `<Panel>` is exactly that, so
every list gets it for free. Radii stay concentric: core = tray minus 4px.

**Controls are pills.** Buttons are `rounded-full`; panels are
`radius + 4/8px`; inputs follow the input-group.

**Motion:** `--ease-spring` / `--ease-out-expo`, never linear or ease-in-out.
`rise-stagger` fades a screen's direct children up in order on mount
(`<Page>` applies it). Everything honours `prefers-reduced-motion`.
