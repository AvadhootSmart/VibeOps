# Third-party notices

VibeOps is licensed under [FSL-1.1-MIT](LICENSE.md). It bundles the
third-party software below, each under its own license. Every license here
is permissive; each package ships its full license text in its own source.

Regenerate with `go-licenses report ./...` (once per `GOOS`: darwin, windows,
linux) and `bunx license-checker --production` in `frontend/`.

## Bundled agent skills

Embedded into the binary from `.agents/skills/`, and copied into
`~/.agents/skills` when a connector is installed or signed in.

| Skill | Source | License |
|---|---|---|
| `ai-elements` | [vercel/ai-elements](https://github.com/vercel/ai-elements) | Apache-2.0 (`.agents/skills/ai-elements/LICENSE`) |
| `cloudflare` | [cloudflare/skills](https://github.com/cloudflare/skills) | Apache-2.0 (`.agents/skills/cloudflare/LICENSE`) |
| `neon`, `supabase`, `vercel` | Written for VibeOps | FSL-1.1-MIT, like the rest of the repo |

## Go modules

| Module | License |
|---|---|
| [github.com/danieljoos/wincred](https://github.com/danieljoos/wincred/blob/v1.2.3/LICENSE) | MIT |
| [github.com/godbus/dbus/v5](https://github.com/godbus/dbus/blob/v5.2.2/LICENSE) | BSD-2-Clause |
| [github.com/leaanthony/go-ansi-parser](https://github.com/leaanthony/go-ansi-parser/blob/v1.6.1/LICENSE) | MIT |
| [github.com/leaanthony/slicer](https://github.com/leaanthony/slicer/blob/v1.6.0/LICENSE) | MIT |
| [github.com/leaanthony/u](https://github.com/leaanthony/u/blob/v1.1.1/LICENSE) | MIT |
| [github.com/pkg/errors](https://github.com/pkg/errors/blob/v0.9.1/LICENSE) | BSD-2-Clause |
| [github.com/rivo/uniseg](https://github.com/rivo/uniseg/blob/v0.4.7/LICENSE.txt) | MIT |
| [github.com/wailsapp/go-webview2/pkg/combridge](https://github.com/wailsapp/go-webview2/blob/v1.0.22/LICENSE) | MIT |
| [github.com/wailsapp/go-webview2/webviewloader](https://github.com/wailsapp/go-webview2/blob/v1.0.22/webviewloader/LICENSE) | ISC |
| [github.com/wailsapp/wails/v2](https://github.com/wailsapp/wails/blob/v2.12.0/v2/LICENSE) | MIT |
| [github.com/wailsapp/wails/v2/internal/frontend/desktop/windows/winc/w32](https://github.com/wailsapp/wails/blob/v2.12.0/v2/internal/frontend/desktop/windows/winc/LICENSE) | MIT |
| [github.com/zalando/go-keyring](https://github.com/zalando/go-keyring/blob/v0.2.8/LICENSE) | MIT |
| [github.com/zalando/go-keyring/internal/shellescape](https://github.com/zalando/go-keyring/blob/v0.2.8/internal/shellescape/LICENSE) | MIT |
| [golang.org/x/crypto](https://cs.opensource.google/go/x/crypto/+/v0.54.0:LICENSE) | BSD-3-Clause |
| [golang.org/x/sys/windows](https://cs.opensource.google/go/x/sys/+/v0.47.0:LICENSE) | BSD-3-Clause |

## Frontend (npm) packages

Fonts under `@fontsource-variable/` are SIL Open Font License 1.1, which
permits bundling them in software.

<details><summary>MIT (390)</summary>

`@antfu/install-pkg@1.1.0`, `@babel/runtime@7.29.7`, `@braintree/sanitize-url@7.1.2`, `@floating-ui/core@1.7.5`, `@floating-ui/dom@1.7.6`, `@floating-ui/react-dom@2.1.8`, `@floating-ui/utils@0.2.11`, `@iconify/types@2.0.0`, `@iconify/utils@3.1.4`, `@mermaid-js/parser@1.2.0`, `@monogrid/gainmap-js@3.4.0`, `@radix-ui/number@1.1.2`, `@radix-ui/primitive@1.1.4`, `@radix-ui/primitive@1.1.7`, `@radix-ui/react-accessible-icon@1.1.11`, `@radix-ui/react-accordion@1.2.15`, `@radix-ui/react-alert-dialog@1.1.18`, `@radix-ui/react-arrow@1.1.11`, `@radix-ui/react-aspect-ratio@1.1.11`, `@radix-ui/react-avatar@1.2.1`, `@radix-ui/react-checkbox@1.3.6`, `@radix-ui/react-collapsible@1.1.15`, `@radix-ui/react-collection@1.1.11`, `@radix-ui/react-compose-refs@1.1.3`, `@radix-ui/react-context-menu@2.3.2`, `@radix-ui/react-context@1.1.4`, `@radix-ui/react-dialog@1.1.18`, `@radix-ui/react-direction@1.1.2`, `@radix-ui/react-dismissable-layer@1.1.14`, `@radix-ui/react-dropdown-menu@2.1.19`, `@radix-ui/react-focus-guards@1.1.4`, `@radix-ui/react-focus-scope@1.1.11`, `@radix-ui/react-form@0.1.11`, `@radix-ui/react-hover-card@1.1.18`, `@radix-ui/react-id@1.1.2`, `@radix-ui/react-label@2.1.11`, `@radix-ui/react-menu@2.1.19`, `@radix-ui/react-menubar@1.1.19`, `@radix-ui/react-navigation-menu@1.2.17`, `@radix-ui/react-one-time-password-field@0.1.11`, `@radix-ui/react-password-toggle-field@0.1.6`, `@radix-ui/react-popover@1.1.18`, `@radix-ui/react-popper@1.3.2`, `@radix-ui/react-portal@1.1.13`, `@radix-ui/react-presence@1.1.6`, `@radix-ui/react-primitive@2.1.7`, `@radix-ui/react-progress@1.1.11`, `@radix-ui/react-radio-group@1.4.2`, `@radix-ui/react-roving-focus@1.1.14`, `@radix-ui/react-scroll-area@1.2.13`, `@radix-ui/react-select@2.3.2`, `@radix-ui/react-separator@1.1.11`, `@radix-ui/react-slider@1.4.2`, `@radix-ui/react-slot@1.3.0`, `@radix-ui/react-switch@1.3.2`, `@radix-ui/react-tabs@1.1.16`, `@radix-ui/react-toast@1.2.18`, `@radix-ui/react-toggle-group@1.1.14`, `@radix-ui/react-toggle@1.1.13`, `@radix-ui/react-toolbar@1.1.14`, `@radix-ui/react-tooltip@1.2.11`, `@radix-ui/react-use-callback-ref@1.1.2`, `@radix-ui/react-use-controllable-state@1.2.3`, `@radix-ui/react-use-controllable-state@1.2.6`, `@radix-ui/react-use-effect-event@0.0.3`, `@radix-ui/react-use-effect-event@0.0.5`, `@radix-ui/react-use-escape-keydown@1.1.3`, `@radix-ui/react-use-is-hydrated@0.1.1`, `@radix-ui/react-use-layout-effect@1.1.2`, `@radix-ui/react-use-layout-effect@1.1.4`, `@radix-ui/react-use-previous@1.1.2`, `@radix-ui/react-use-rect@1.1.2`, `@radix-ui/react-use-size@1.1.2`, `@radix-ui/react-visually-hidden@1.2.7`, `@radix-ui/rect@1.1.2`, `@react-spring/animated@9.7.5`, `@react-spring/core@9.7.5`, `@react-spring/rafz@9.7.5`, `@react-spring/shared@9.7.5`, `@react-spring/three@9.7.5`, `@react-spring/types@9.7.5`, `@react-three/drei@9.122.0`, `@react-three/fiber@8.18.0`, `@shikijs/core@3.23.0`, `@shikijs/core@4.3.1`, `@shikijs/engine-javascript@3.23.0`, `@shikijs/engine-javascript@4.3.1`, `@shikijs/engine-oniguruma@3.23.0`, `@shikijs/engine-oniguruma@4.3.1`, `@shikijs/langs@3.23.0`, `@shikijs/langs@4.3.1`, `@shikijs/primitive@4.3.1`, `@shikijs/themes@3.23.0`, `@shikijs/themes@4.3.1`, `@shikijs/types@3.23.0`, `@shikijs/types@4.3.1`, `@shikijs/vscode-textmate@10.0.2`, `@standard-schema/spec@1.1.0`, `@tweenjs/tween.js@23.1.3`, `@types/d3-array@3.2.2`, `@types/d3-axis@3.0.6`, `@types/d3-brush@3.0.6`, `@types/d3-chord@3.0.6`, `@types/d3-color@3.1.3`, `@types/d3-contour@3.0.6`, `@types/d3-delaunay@6.0.4`, `@types/d3-dispatch@3.0.7`, `@types/d3-drag@3.0.7`, `@types/d3-dsv@3.0.7`, `@types/d3-ease@3.0.2`, `@types/d3-fetch@3.0.7`, `@types/d3-force@3.0.10`, `@types/d3-format@3.0.4`, `@types/d3-geo@3.1.0`, `@types/d3-hierarchy@3.1.7`, `@types/d3-interpolate@3.0.4`, `@types/d3-path@3.1.1`, `@types/d3-polygon@3.0.2`, `@types/d3-quadtree@3.0.6`, `@types/d3-random@3.0.4`, `@types/d3-scale-chromatic@3.1.0`, `@types/d3-scale@4.0.9`, `@types/d3-selection@3.0.11`, `@types/d3-shape@3.1.8`, `@types/d3-time-format@4.0.3`, `@types/d3-time@3.0.4`, `@types/d3-timer@3.0.2`, `@types/d3-transition@3.0.9`, `@types/d3-zoom@3.0.8`, `@types/d3@7.4.3`, `@types/debug@4.1.13`, `@types/draco3d@1.4.10`, `@types/estree-jsx@1.0.5`, `@types/estree@1.0.8`, `@types/geojson@7946.0.16`, `@types/hast@3.0.5`, `@types/katex@0.16.8`, `@types/mdast@4.0.4`, `@types/ms@2.1.0`, `@types/offscreencanvas@2019.7.3`, `@types/prop-types@15.7.15`, `@types/react-dom@18.3.7`, `@types/react-reconciler@0.26.7`, `@types/react-reconciler@0.28.9`, `@types/react@18.3.27`, `@types/stats.js@0.17.4`, `@types/three@0.171.0`, `@types/trusted-types@2.0.7`, `@types/unist@2.0.11`, `@types/unist@3.0.3`, `@types/webxr@0.5.24`, `@upsetjs/venn.js@2.0.0`, `@use-gesture/core@10.3.1`, `@use-gesture/react@10.3.1`, `aria-hidden@1.2.6`, `bail@2.0.2`, `base64-js@1.5.1`, `bidi-js@1.0.3`, `buffer@6.0.3`, `camera-controls@2.10.1`, `ccount@2.0.1`, `character-entities-html4@2.1.0`, `character-entities-legacy@3.0.0`, `character-entities@2.0.2`, `character-reference-invalid@2.0.1`, `clsx@2.1.1`, `cmdk@1.1.1`, `comma-separated-tokens@2.0.3`, `commander@7.2.0`, `commander@8.3.0`, `cookie@1.1.1`, `cose-base@1.0.3`, `cose-base@2.2.0`, `cross-env@7.0.3`, `cross-spawn@7.0.6`, `csstype@3.2.3`, `cytoscape-cose-bilkent@4.1.0`, `cytoscape-fcose@2.2.0`, `cytoscape@3.34.0`, `dagre-d3-es@7.0.14`, `dayjs@1.11.21`, `debug@4.4.3`, `decode-named-character-reference@1.3.0`, `dequal@2.0.3`, `detect-gpu@5.0.70`, `detect-node-es@1.1.0`, `devlop@1.1.0`, `es-toolkit@1.50.0`, `escape-string-regexp@5.0.0`, `estree-util-is-identifier-name@3.0.0`, `eventsource-parser@3.1.0`, `extend@3.0.2`, `fflate@0.6.10`, `fflate@0.8.3`, `framer-motion@12.42.2`, `get-east-asian-width@1.6.0`, `get-nonce@1.0.1`, `glsl-noise@0.0.0`, `hachure-fill@0.5.2`, `hast-util-from-html-isomorphic@2.0.0`, `hast-util-from-html@2.0.3`, `hast-util-from-parse5@8.0.3`, `hast-util-is-element@3.0.0`, `hast-util-parse-selector@4.0.0`, `hast-util-raw@9.1.0`, `hast-util-sanitize@5.0.2`, `hast-util-to-html@9.0.5`, `hast-util-to-jsx-runtime@2.3.6`, `hast-util-to-parse5@8.0.1`, `hast-util-to-text@4.0.2`, `hast-util-whitespace@3.0.0`, `hastscript@9.0.1`, `html-url-attributes@3.0.1`, `html-void-elements@3.0.0`, `iconv-lite@0.6.3`, `immediate@3.0.6`, `import-meta-resolve@4.2.0`, `inline-style-parser@0.2.7`, `is-alphabetical@2.0.1`, `is-alphanumerical@2.0.1`, `is-decimal@2.0.1`, `is-hexadecimal@2.0.1`, `is-plain-obj@4.1.0`, `is-promise@2.2.2`, `its-fine@1.2.5`, `js-tokens@4.0.0`, `katex@0.16.47`, `layout-base@1.0.2`, `layout-base@2.0.1`, `lie@3.3.0`, `lodash-es@4.18.1`, `longest-streak@3.1.0`, `loose-envify@1.4.0`, `maath@0.10.8`, `markdown-table@3.0.4`, `marked@16.4.2`, `marked@17.0.6`, `mdast-util-find-and-replace@3.0.2`, `mdast-util-from-markdown@2.0.3`, `mdast-util-gfm-autolink-literal@2.0.1`, `mdast-util-gfm-footnote@2.1.0`, `mdast-util-gfm-strikethrough@2.0.0`, `mdast-util-gfm-table@2.0.0`, `mdast-util-gfm-task-list-item@2.0.0`, `mdast-util-gfm@3.1.0`, `mdast-util-math@3.0.0`, `mdast-util-mdx-expression@2.0.1`, `mdast-util-mdx-jsx@3.2.0`, `mdast-util-mdxjs-esm@2.0.1`, `mdast-util-phrasing@4.1.0`, `mdast-util-to-hast@13.2.1`, `mdast-util-to-markdown-cjk-friendly-gfm-strikethrough@1.0.0`, `mdast-util-to-markdown-cjk-friendly@1.0.0`, `mdast-util-to-markdown@2.1.2`, `mdast-util-to-string@4.0.0`, `mermaid@11.16.0`, `meshline@3.3.1`, `meshoptimizer@0.18.1`, `micromark-core-commonmark@2.0.3`, `micromark-extension-cjk-friendly-gfm-strikethrough@2.0.1`, `micromark-extension-cjk-friendly-util@3.0.1`, `micromark-extension-cjk-friendly@2.0.1`, `micromark-extension-gfm-autolink-literal@2.1.0`, `micromark-extension-gfm-footnote@2.1.0`, `micromark-extension-gfm-strikethrough@2.1.0`, `micromark-extension-gfm-table@2.1.1`, `micromark-extension-gfm-tagfilter@2.0.0`, `micromark-extension-gfm-task-list-item@2.1.0`, `micromark-extension-gfm@3.0.0`, `micromark-extension-math@3.1.0`, `micromark-factory-destination@2.0.1`, `micromark-factory-label@2.0.1`, `micromark-factory-space@2.0.1`, `micromark-factory-title@2.0.1`, `micromark-factory-whitespace@2.0.1`, `micromark-util-character@2.1.1`, `micromark-util-chunked@2.0.1`, `micromark-util-classify-character@2.0.1`, `micromark-util-combine-extensions@2.0.1`, `micromark-util-decode-numeric-character-reference@2.0.2`, `micromark-util-decode-string@2.0.1`, `micromark-util-encode@2.0.1`, `micromark-util-html-tag-name@2.0.1`, `micromark-util-normalize-identifier@2.0.1`, `micromark-util-resolve-all@2.0.1`, `micromark-util-sanitize-uri@2.0.1`, `micromark-util-subtokenize@2.1.0`, `micromark-util-symbol@2.0.1`, `micromark-util-types@2.0.2`, `micromark@4.0.2`, `motion-dom@12.42.2`, `motion-utils@12.39.0`, `motion@12.42.2`, `ms@2.1.3`, `nanoid@6.0.0`, `next-themes@0.4.6`, `object-assign@4.1.1`, `oniguruma-parser@0.12.2`, `oniguruma-to-es@4.3.6`, `package-manager-detector@1.8.0`, `parse-entities@4.0.2`, `parse5@7.3.0`, `path-data-parser@0.1.0`, `path-key@3.1.1`, `points-on-curve@0.2.0`, `points-on-path@0.2.1`, `prop-types@15.8.1`, `property-information@7.2.0`, `radix-ui@1.6.1`, `react-composer@5.0.3`, `react-dom@18.3.1`, `react-is@16.13.1`, `react-reconciler@0.27.0`, `react-remove-scroll-bar@2.3.8`, `react-remove-scroll@2.7.2`, `react-router-dom@7.18.1`, `react-router@7.18.1`, `react-style-singleton@2.2.3`, `react-use-measure@2.1.7`, `react@18.3.1`, `regex-recursion@6.0.2`, `regex-utilities@2.3.0`, `regex@6.1.0`, `rehype-harden@1.1.8`, `rehype-katex@7.0.1`, `rehype-raw@7.0.0`, `rehype-sanitize@6.0.0`, `remark-cjk-friendly-gfm-strikethrough@2.3.1`, `remark-cjk-friendly@2.3.1`, `remark-gfm@4.0.1`, `remark-math@6.0.0`, `remark-parse@11.0.0`, `remark-rehype@11.1.2`, `remark-stringify@11.0.0`, `require-from-string@2.0.2`, `roughjs@4.6.6`, `safer-buffer@2.1.2`, `scheduler@0.21.0`, `scheduler@0.23.2`, `set-cookie-parser@2.7.2`, `shebang-command@2.0.0`, `shebang-regex@3.0.0`, `shiki@3.23.0`, `shiki@4.3.1`, `sonner@2.0.8`, `space-separated-tokens@2.0.2`, `stats-gl@2.4.2`, `stats.js@0.17.0`, `stringify-entities@4.0.4`, `style-to-js@1.1.21`, `style-to-object@1.0.14`, `stylis@4.4.0`, `suspend-react@0.1.3`, `tailwind-merge@2.6.0`, `tailwind-merge@3.6.0`, `three-mesh-bvh@0.7.8`, `three-stdlib@2.36.1`, `three@0.170.0`, `three@0.171.0`, `tinyexec@1.2.4`, `trim-lines@3.0.1`, `troika-three-text@0.52.4`, `troika-three-utils@0.52.4`, `troika-worker-utils@0.52.0`, `trough@2.2.0`, `ts-dedent@2.3.0`, `tunnel-rat@0.1.2`, `unified@11.0.5`, `unist-util-find-after@5.0.0`, `unist-util-is@6.0.1`, `unist-util-position@5.0.0`, `unist-util-remove-position@5.0.0`, `unist-util-stringify-position@4.0.0`, `unist-util-visit-parents@6.0.2`, `unist-util-visit@5.1.0`, `use-callback-ref@1.3.3`, `use-sidecar@1.1.3`, `use-sync-external-store@1.6.0`, `utility-types@3.11.0`, `uuid@14.0.1`, `vfile-location@5.0.3`, `vfile-message@4.0.3`, `vfile@6.0.3`, `web-namespaces@2.0.1`, `webgl-sdf-generator@1.1.1`, `zod@4.4.3`, `zustand@3.7.2`, `zustand@4.5.7`, `zustand@5.0.14`, `zwitch@2.0.4`

</details>

<details><summary>ISC (38)</summary>

`@ungap/structured-clone@1.3.3`, `d3-array@3.2.4`, `d3-axis@3.0.0`, `d3-brush@3.0.0`, `d3-chord@3.0.1`, `d3-color@3.1.0`, `d3-contour@4.0.2`, `d3-delaunay@6.0.4`, `d3-dispatch@3.0.1`, `d3-drag@3.0.0`, `d3-dsv@3.0.1`, `d3-fetch@3.0.1`, `d3-force@3.0.0`, `d3-format@3.1.2`, `d3-geo@3.1.1`, `d3-hierarchy@3.1.2`, `d3-interpolate@3.0.1`, `d3-path@3.1.0`, `d3-polygon@3.0.1`, `d3-quadtree@3.0.1`, `d3-random@3.0.1`, `d3-scale-chromatic@3.1.0`, `d3-scale@4.0.2`, `d3-selection@3.0.0`, `d3-shape@3.2.0`, `d3-time-format@4.1.0`, `d3-time@3.1.0`, `d3-timer@3.0.1`, `d3-transition@3.0.1`, `d3-zoom@3.0.0`, `d3@7.9.0`, `delaunator@5.1.0`, `hast-util-from-dom@5.0.1`, `internmap@1.0.1`, `isexe@2.0.0`, `lucide-react@0.468.0`, `potpack@1.0.2`, `which@2.0.2`

</details>

<details><summary>Apache-2.0 (19)</summary>

`@ai-sdk/gateway@4.0.19`, `@ai-sdk/provider-utils@5.0.9`, `@ai-sdk/provider@4.0.3`, `@chevrotain/types@11.1.2`, `@mediapipe/tasks-vision@0.10.17`, `@openrouter/ai-sdk-provider@3.0.0`, `@streamdown/cjk@1.0.3`, `@streamdown/code@1.1.1`, `@streamdown/math@1.0.2`, `@streamdown/mermaid@1.0.2`, `@vercel/oidc@3.2.0`, `@workflow/serde@4.1.0`, `ai@7.0.26`, `class-variance-authority@0.7.1`, `draco3d@1.5.7`, `hls.js@1.6.16`, `promise-worker-transferable@1.0.4`, `remend@1.3.0`, `streamdown@2.5.0`

</details>

<details><summary>BSD-3-Clause (8)</summary>

`@webgpu/types@0.1.71`, `d3-array@2.12.1`, `d3-ease@3.0.1`, `d3-path@1.0.9`, `d3-sankey@0.12.3`, `d3-shape@1.3.7`, `ieee754@1.2.1`, `rw@1.3.3`

</details>

<details><summary>OFL-1.1 (7)</summary>

`@fontsource-variable/geist-mono@5.3.0`, `@fontsource-variable/geist@5.3.0`, `@fontsource-variable/jetbrains-mono@5.3.0`, `@fontsource-variable/nunito@5.3.0`, `@fontsource-variable/outfit@5.3.0`, `@fontsource-variable/sora@5.3.0`, `@fontsource-variable/space-grotesk@5.3.0`

</details>

<details><summary>MIT* (2)</summary>

`khroma@2.1.0`, `webgl-constants@1.1.1`

</details>

<details><summary>(AFL-2.1 OR BSD-3-Clause) (1)</summary>

`json-schema@0.4.0`

</details>

<details><summary>0BSD (1)</summary>

`tslib@2.8.1`

</details>

<details><summary>Apache-2.0 (dual-licensed MPL-2.0 OR Apache-2.0; used under Apache-2.0) (1)</summary>

`dompurify@3.4.12`

</details>

<details><summary>BSD-2-Clause (1)</summary>

`entities@6.0.1`

</details>

<details><summary>Unlicense (1)</summary>

`robust-predicates@3.0.3`

</details>
