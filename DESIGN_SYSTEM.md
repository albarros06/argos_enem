# Argos Design System

Argos is a text-correction product (grammar, style, clarity review). This design system is built from the product's logotype exploration — there is no existing codebase, Figma file, or brand guideline attached. All tokens and components below are derived from the approved logo mark ("Vesica") and extended into a full system from scratch.

**Sources**: `Argos Logo.html` (symbol exploration), `Argos — Vesica.html` (final mark + lockups + social assets), `assets/` (exported SVG/PNG files). No external codebase or Figma link was provided.

## Brand concept
Argos Panoptes, the hundred-eyed giant of Greek myth — the guardian who sees everything. The symbol ("Vesica") reduces this to two mirrored arcs and a central pupil: an abstract eye/lens, never drawn literally.

## Content fundamentals
- **Language**: Portuguese (Brazil), plain and direct — copy in this project is written in pt-BR.
- **Tone**: precise, calm, a little technical — the product corrects text, so its own voice should read as careful and unfussy. No exclamation points, no hype.
- **Casing**: sentence case for UI copy and headings; labels/eyebrows in uppercase mono with wide tracking (`--tracking-label`) as a structural accent, not for full sentences.
- **Emoji**: not used anywhere in the source material — avoid them.
- **Numbers/stats**: used only when meaningful (e.g. "12 sugestões aplicadas"), never decorative.

## Visual foundations
- **Color**: dark-first UI (`--surface-bg: #0E0E13`). Brand color is a blue→violet gradient (`--gradient-brand`, 2E5BFF → 8A3FFE) reserved for primary actions, the mark, and focus accents — not backgrounds at scale. Neutrals are a 5-step ink scale; borders are low-opacity white hairlines (`--line-dark`, 8%). A light theme exists (`[data-theme="light"]`) for print/social contexts.
- **Type**: Space Grotesk (display + body) paired with IBM Plex Mono (labels, eyebrows, technical/meta text). Headings use tight tracking (-0.02em); mono labels use wide tracking (+0.16em) and uppercase.
- **Shape**: soft geometric radii — 8/12/18/22/26px steps, pill (999px) for buttons and toggles. Cards get 18–26px radius, never sharp corners.
- **Elevation**: flat by default; dark tiles + hairline borders do most of the separation. Shadows (`--shadow-sm/md/lg`) are reserved for floating elements (dialogs, toasts, tooltips). A `--shadow-glow` (soft violet halo) is available for featured/hero moments only.
- **Gradients**: exactly one — the brand blue→violet — used sparingly (primary buttons, the mark, accent hairlines on cards). Never apply it to large background areas.
- **Motion**: not yet defined by source material; keep transitions short (150–200ms ease) and subtle — color/opacity/transform only, no bounce.
- **Backgrounds**: solid dark surfaces with an optional soft radial violet glow (see social banners in `assets/`) — no photography, no patterns, no illustration style established yet.
- **Borders/dividers**: 1px hairlines at 8% opacity on dark backgrounds.

## Iconography
No icon set exists in the source material. The only vetted graphic is the Vesica mark itself (two arcs + pupil), used standalone or with the wordmark. **Do not invent new icons or draw ad-hoc SVGs for this brand** — if a UI needs icons beyond the mark, flag it and substitute a neutral CDN icon set (e.g. Lucide) until the brand defines one, and note the substitution.

## Assets
`assets/` contains the exported mark: gradient/blue/violet/white/black SVGs, transparent PNGs, avatar (1024, dark/gradient), favicon (256), horizontal/stacked lockups, and social banners (LinkedIn, X, Instagram).

## Contents
- `styles.css` — entry point, imports all tokens.
- `tokens/` — colors, typography (+ `@font-face`), spacing, radius, shadows.
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand) shown in the Design System tab.
- `components/forms/` — Button, Input, Select, Checkbox, Radio, Switch.
- `components/feedback/` — Badge, Tooltip, Toast.
- `components/navigation/` — Tabs.
- `components/overlay/` — Dialog.
- `components/core/` — Card.
- `assets/` — logo files, avatars, favicon, banners.

## Intentional additions
No source defined a component inventory, so the standard primitive set above was authored from scratch to match the brand's visual language (gradient, radii, type). None of these map to an existing spec — treat them as a reasonable starting point, not ground truth.
