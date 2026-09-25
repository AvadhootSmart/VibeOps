1. Make theme file — frontend/src/themes/foo.style.css. Scope every var block by [data-theme]. Take your CSS :root {...} / .dark {...} and rewrite selectors:

@import "@fontsource-variable/your-font"; /* fonts theme needs */

:root[data-theme="foo"] {
--radius: ...;
--font-sans: "Your Font Variable", sans-serif;
--font-mono: "...";
/* all the light --background, --primary ... vars _/
}
:root[data-theme="foo"].dark {
/_ all the dark vars */
}

Only scope change: :root → :root[data-theme="foo"], .dark → :root[data-theme="foo"].dark. Drop tweakcn extras (shadow/spacing/tracking) — base @theme no consume them.

2. Install fonts if new:
   cd frontend && bun add @fontsource-variable/your-font

3. Import in frontend/src/style.css — add by other theme imports:
   @import "./themes/foo.style.css";

4. Register in frontend/src/lib/theme.ts — add to THEMES:
   { id: "foo", label: "Foo", blurb: "...", swatch: ["#bg", "#primary", "#accent"] },

id must equal data-theme value. Done — picker in Settings→Appearance auto-shows it.

Verify: cd frontend && bun run build.
