## Argos design conventions

A friendly, "Duolingo-like" look: blue-forward brand color, chunky rounded
corners, bold uppercase buttons with a signature 3D "pressable" effect.
Everything is driven by CSS custom properties — never hardcode a color,
spacing, or radius value; always reach for the matching token below.

### Wrapping

Any composition that uses `ThemeToggle` (or reads theme state) must be
wrapped in the provider, or it throws:

```jsx
const { ThemeProvider, ThemeToggle, Card, Button } = window.ArgosDS;
<ThemeProvider>
  <Card><Button variant="primary">Enviar</Button></Card>
</ThemeProvider>
```

Other components don't require it, but wrapping the whole app root in
`ThemeProvider` is always safe and is what the real app does.

### The pressable-button idiom

Primary/secondary buttons (and the plain `.button`/`.button.secondary`
classes used on raw `<a>`/`<button>` outside the component set) use a
"3D drop" look, not a flat button: a solid `box-shadow` offset by
`--btn-drop` (4px) in the variant's "strong" color, which collapses to
`0 0 0` and the whole button shifts down `translateY(var(--btn-drop))` on
`:active`. Text is always `font-weight: 800`, `text-transform: uppercase`,
`letter-spacing: 0.03em`. Reuse this pattern for any new pressable control —
don't invent a flat-shadow alternative.

### Token vocabulary (real names, from `_ds_bundle.css`)

- **Brand**: `--color-primary-brand`, `-hover`, `-strong` (3D shadow base),
  `-soft`/`-softer` (tints). `--color-sky*` and `--color-secondary-violet`
  are accents, used sparingly.
- **Semantic triads** — each has a base, a `-strong` (text-on-tint / active
  shadow), and a `-soft` (tinted background) EXCEPT `info`, which has no
  `-strong`: `--color-error(-strong/-soft)`, `--color-warning(-strong/-soft)`,
  `--color-success(-strong/-soft)`, `--color-info(-soft)`.
- **Surfaces/text**: `--color-surface-bg/fg/alt/sunken`,
  `--color-text-primary/secondary/tertiary/on-brand` (use `on-brand` for
  text over any solid brand/semantic color — never hardcode white).
- **Borders**: `--color-border-default` (thin, most inputs/selects) vs.
  `--color-border-strong` (secondary buttons, some checked states) — these
  are two different weights used deliberately, not interchangeable.
- **Radius scale**: `--radius-sm/md/lg/xl/2xl`, plus purpose-built
  `--radius-button` (16px), `--radius-input` (14px), `--radius-card` (20px),
  `--radius-modal` (24px), `--radius-pill` (badges, switches, avatars).
- **Shadows**: `--shadow-sm/md/lg` (elevation), `--shadow-glow` (brand
  emphasis), `--shadow-focus` (the standard focus ring — pair with
  `outline: none`).
- **Type**: `--type-family-display` (headings, `font-weight: 800`+),
  `--type-family-body` (everything else) — both resolve to Nunito, loaded
  from Google Fonts at runtime (not bundled as a font file).
- **Spacing**: `--space-xs` through `--space-3xl`, a straightforward
  4/8/12/24/32/48/64px scale — always use these over ad-hoc px values.

### Where the truth lives

Read `styles.css` → `_ds_bundle.css` for the authoritative, always-current
token values and every component's real CSS (all `:root` custom properties
live here — there's no separate `tokens/*.css` split for this DS). Read
`components/<group>/<Name>/<Name>.prompt.md` for per-component usage before
composing with it.

### Cards, borders, containers

Default cards use a slightly thicker bottom border (`border-bottom-width:
3px` vs `2px` on the other three sides) for a subtle "resting on a surface"
effect — carry this over into any new card-like container rather than a
uniform border.
