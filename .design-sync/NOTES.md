# Design-sync notes — argos-enem

## Repo shape
- This is a Next.js **application**, not a publishable component-library
  package. There is no `dist/` build for the design system — `srcDir` points
  the converter directly at `src/components` in synth-entry mode. Prop types
  are inferred from source, not a real shipped `.d.ts`.
- Scope is the 14 shared design-system components only (Badge, Button, Card,
  Checkbox, Dialog, Input, Modal, Radio, Select, Switch, Tabs, ThemeToggle,
  Toast, Tooltip). `src/components/` also holds app-specific feature
  components (LogoutButton, RenewalBanner, AnnotatedText, CreditBalance) —
  excluded via `componentSrcMap: null` since they're not part of the shared
  design system.
- `ThemeToggleClient` is a thin `'use client'` re-export wrapper around
  `ThemeToggle` (Next.js SSR-safety pattern) — excluded to avoid a duplicate
  card for the same component.

## Styles
- The real app imports stylesheets in `src/app/layout.tsx`, in this order:
  `globals.css`, then `src/styles/tokens.css`, then `src/styles/theme.css`.
  None of these `@import` each other.
- `cssEntry` points at `.design-sync/style-entry.css`, a **literal
  concatenation** of those three files' real content — NOT `@import`.
  `cfg.cssEntry` content gets `appendFileSync`'d after the bundle's existing
  component CSS (esbuild already emits CSS from each component's
  `.module.css` import), so anything after the first rule is a non-top
  position for `@import` — browsers silently ignore an `@import` there, which
  would have meant every token variable resolving to nothing. Regenerate
  `style-entry.css` (re-run the `cat` in git history / see below) whenever
  `globals.css`, `tokens.css`, or `theme.css` change:
  ```sh
  { cat src/app/globals.css; echo; cat src/styles/tokens.css; echo; cat src/styles/theme.css; } \
    > .design-sync/style-entry.css   # then re-add the header comment
  ```
- Brand font (Nunito, `--type-family-body`/`--type-family-display`) is loaded
  in the real app via a `<link>` tag with `preconnect` in `src/app/layout.tsx`
  `<head>` — not a CSS `@import`, and (per the point above) a remote
  `@import url(...)` stuffed into `cssEntry` wouldn't land in a valid
  position anyway. Declared instead via `cfg.runtimeFontPrefixes: ["Nunito"]`
  (the documented mechanism for a family served by a runtime font
  service/CDN) — this suppresses `[FONT_MISSING]` honestly rather than
  faking self-containment; previews render in the fallback stack (Segoe UI /
  system-ui), not actual Nunito. Acceptable tradeoff for a first sync;
  revisit only if font fidelity in previews turns out to matter more than
  expected.

## Provider
- `ThemeToggle` calls `useTheme()` from `@/contexts/ThemeContext`, which
  throws outside `ThemeProvider`. `ThemeContext` lives in `src/contexts/`,
  outside `srcDir`, so it's pulled into the bundle via
  `extraEntries: ["./src/contexts/ThemeContext.tsx"]` (extension required —
  `cfgPath` resolution does a plain `existsSync`, no extension probing) and
  wired as
  `cfg.provider.component = "ThemeProvider"`.
- No other of the 14 components read from context/router — verified by
  grepping for `useContext|useTheme|createPortal|useRouter|usePathname` across
  `src/components`.

## Fork: source-kit.mjs (declared in cfg.libOverrides)
- Upstream's synth-entry file filter (used to write `.pkg-entry.mjs`) ignored
  `componentSrcMap: null` — it only affected the component name-list, not
  which files get `export *`'d into the bundle entry. That meant the 4
  excluded app-specific files (LogoutButton, RenewalBanner, AnnotatedText,
  CreditBalance) were bundled anyway, dragging in `next/link`,
  `next/navigation`, and next-auth code full of `process.env.*` references —
  `process` isn't defined in a browser, so it crashed EVERY component's
  render with `ReferenceError: process is not defined` and made all 14
  fail `[BUNDLE_EXPORT]`. Forked to make the synth-entry filter honor
  `componentSrcMap: null` by basename, matching the name-list behavior.
- If `componentSrcMap` gains new `null` exclusions in the future, this fork
  already covers them (matches by basename generically, not hardcoded to the
  current 4 names) — no fork update needed for that case. Only revisit the
  fork if upstream's `resolvePackage` signature/logic changes structurally
  (diff against `.ds-sync/lib/source-kit.mjs` on re-sync, as usual for
  `libOverrides`).

## Overlay components need a portal in the authored preview (Dialog, Modal, Toast — all done)
- The card harness (`lib/emit.mjs`, off-limits to fork) wraps every story
  root in an element with `transform: translateZ(0)`
  (`.ds-single`/`.ds-cell`). Per the CSS spec, a `transform` on an ancestor
  makes it the containing block for `position: fixed` descendants — so a
  full-viewport overlay sizes/centers against its own tiny content box
  instead of the real viewport, clipping content no matter how tall the
  configured `viewport` override was.
- Fix (applied in all three previews): `createPortal` the component into
  `document.body` from within the preview story function. `document.body`
  has no transformed ancestor, so `position: fixed` resolves against the
  real viewport again. `react-dom`'s `createPortal` is available in
  previews (the shim spreads the real `window.ReactDOM`).
- **No `cfg.overrides` (`cardMode`/`viewport`) turned out to be needed for
  any of the three** — default grid mode renders all of them correctly once
  the portal fix is in place. Dialog's `cfg.overrides.Dialog: {"cardMode":
  "single", "viewport": "480x420"}` in config.json predates this finding and
  is harmless/redundant, not required — left as-is rather than churned.
- If a future component uses `position: fixed`, use this same portal
  pattern in its preview; don't reach for a `cardMode` override for this
  specific problem, it doesn't address the root cause.

## Interaction-simulation techniques for uncontrolled open/hover state
Two components have internal (`useState`) open/visible state with no prop
to force it open — needed for a real screenshot instead of only the
closed/default state:
- **Select's dropdown**: `useRef` + `useEffect` that calls `.click()` on the
  real trigger button on mount (a normal simulated user interaction, not a
  reimplementation). Worked with zero adjustment.
- **Tooltip's hover bubble**: `useRef` + `useEffect` dispatching a synthetic
  `mouseover` event. Two gotchas hit here, both fixed in
  `.design-sync/previews/Tooltip.tsx`:
  1. The dispatch target must be Tooltip's own internal wrapper div (found
     via `document.querySelector('[class*="Tooltip_wrapper"]')` after
     mount) — dispatching on an ancestor ref does nothing, since DOM events
     bubble up from the target, never down to descendants.
  2. The tooltip bubble is absolutely positioned relative to the trigger and
     can be wider than it — with the trigger near a card edge, longer
     strings (especially `position="left"`) got clipped by the card's
     `overflow: hidden`. Padding alone wasn't reliable; fixed by centering
     the trigger in a fixed-size box (520×260, flex-centered) for symmetric
     clearance in every direction regardless of content length or position.
- **Reusable pattern**: for any other uncontrolled-open-state component
  that does NOT use `position: fixed`, the "simulate the real trigger
  interaction via useRef+useEffect" technique is simpler than a portal and
  needs no config override — reach for it first.

## Authored previews: status
All 14 components have authored previews (`.design-sync/previews/`), each
cell graded `good` — Badge, Dialog, Tabs done solo; Button, Card, Checkbox,
Switch, Input, Radio, Select, ThemeToggle, Modal, Toast, Tooltip done via 3
parallel subagent batches, each verified against the actual screenshots
before pushing. Full component list, real-vs-invented content per component,
and per-cell grading notes are preserved in the grade files under
`.design-sync/.cache/review/*.grade.json` (gitignored, but the uploaded
`_ds_sync.json` anchors verified-by-upload state for future syncs).

## Re-sync risks
- If new shared components are added under `src/components/<Name>/`, they'll
  be picked up automatically (matches the folder convention) — no config
  change needed unless the fuzzy-find misses them.
- If a new *app-specific* (non-design-system) component is added as a loose
  `.tsx` directly under `src/components/` (sibling to the subfolders, not
  inside one), it will be picked up by the synth-entry scan and needs an
  explicit `componentSrcMap: {"<Name>": null}` exclusion, same as the four
  listed above.
- `style-entry.css` is a point-in-time literal copy, not a live import — if
  `globals.css`/`tokens.css`/`theme.css` change, re-run the concatenation
  above before the next build or previews silently drift from the real app's
  styling. This is the single highest-risk staleness point in this sync.
- Font fidelity in previews is a known, accepted gap (fallback font stack,
  not real Nunito) per the `runtimeFontPrefixes` note above.
