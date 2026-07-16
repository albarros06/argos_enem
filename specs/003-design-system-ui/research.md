# Research & Design Decisions: Design System UI

**Date**: 2026-07-15 | **Phase**: 0 (Research)

## Decision 1: Token Format & Storage

**Question**: How should design tokens be stored and accessed — CSS custom properties, JavaScript objects, or both?

**Decision**: **CSS custom properties (custom-properties.css) with optional TypeScript export for type safety**

**Rationale**:
- CSS custom properties are native browser API (IE 11+, all modern browsers) — no runtime dependency
- Tokens change at runtime (theme switching) — custom properties enable instant updates via CSS
- Zero JavaScript overhead; no parsing or module loading required
- Can coexist with TypeScript types for development ergonomics

**Implementation**:
- `src/styles/tokens.css` — defines all custom properties (colors, spacing, etc.) for both dark/light themes
- Optional: `src/tokens/index.ts` — TypeScript exports of token values for use in components that need JS (e.g., calculating dimensions)
- Default: components use CSS variables directly (`color: var(--color-primary-brand)`)

**Alternatives considered**:
- Pure JavaScript objects: flexible but requires runtime parsing; overkill for static values
- Design tokens tooling (Style Dictionary, Tokens Studio): unnecessary complexity per Constitution II; hand-authored tokens are simpler and sufficient
- SCSS/LESS variables: deprecated in favor of CSS custom properties; less dynamic

---

## Decision 2: Theme Switching Mechanism

**Question**: How should dark/light theme switching work — localStorage, URL parameter, system preference, or CSS attribute?

**Decision**: **CSS attribute (`[data-theme="dark"|"light"]`) + localStorage persistence + system preference detection**

**Rationale**:
- CSS attribute on `<html>` enables instant visual update via CSS variable overrides (no JS rerender)
- localStorage persists user choice across sessions
- System preference (`prefers-color-scheme`) provides sensible default on first visit
- Non-JavaScript users get correct theme via CSS media query fallback

**Implementation**:
- `src/lib/theme.ts` — utilities: `getThemePreference()`, `setTheme(theme)`, `initTheme()`
- `src/contexts/ThemeContext.tsx` — React provider for components that need theme info (optional; most won't need it)
- `src/app/layout.tsx` — root layout:
  1. Read localStorage on mount
  2. Apply to `<html data-theme={theme}>`
  3. CSS handles the rest
- `src/styles/theme.css` — per-theme variable overrides

**Alternatives considered**:
- URL parameter: breaks page sharing; pollutes URL bar; not persistent
- System preference only: ignores user choice; no manual override
- localStorage + context rerender: works but unnecessary rerenders; CSS attribute is simpler

---

## Decision 3: Token Naming Convention

**Question**: What naming scheme ensures clarity and prevents conflicts?

**Decision**: **`--[category]-[property]-[variant]` (BEM-inspired for CSS custom properties)**

**Rationale**:
- Category groups related tokens (color, space, radius, etc.)
- Property describes the value (primary, lg, glow, etc.)
- Variant handles theme/state alternatives (dark/light, hover, active, etc.)
- Self-documenting: developers can guess intent without consulting spec

**Examples**:
- `--color-primary-brand` (category: color, property: primary, variant: brand)
- `--space-lg` (category: space, property: lg, no variant)
- `--radius-button` (category: radius, property: button)
- `--shadow-glow` (category: shadow, property: glow)
- `--type-heading-lg` (category: type, property: heading, variant: lg)

**Alternatives considered**:
- Simple names (`--primary`, `--large`): too vague; collisions across categories
- Scoped naming (`--ds-color-primary`): verbose; unnecessary prefix
- No convention: inconsistent; hard to discover tokens

---

## Decision 4: Token File Organization

**Question**: Should tokens be organized as a flat list, hierarchy by category, or something else?

**Decision**: **Separate files per category (colors.ts, typography.ts, spacing.ts, etc.) + single export from index.ts**

**Rationale**:
- Mirrors semantic organization of DESIGN_SYSTEM.md (colors, typography, spacing sections)
- Easy to locate and modify a token category
- Scales to additional categories without cluttering a single file
- Re-exports from index.ts provide single import point for consumers

**Structure**:
```
src/tokens/
├── colors.ts        # Color palette + gradients
├── typography.ts    # Fonts, sizes, weights, tracking
├── spacing.ts       # Spacing scale
├── radii.ts         # Border radius values
├── shadows.ts       # Elevation levels
├── gradients.ts     # Brand gradient
└── index.ts         # export { colors, typography, spacing, ... }
```

**Alternatives considered**:
- Single `tokens.ts` file: gets large; harder to navigate; categories mixed
- Nested by theme: unnecessary; themes are CSS variable overrides, not separate token sets

---

## Decision 5: Component Refactoring Order

**Question**: In what order should components be refactored to use tokens?

**Decision**: **Priority-based per user story: P1 (developer tokens) → P2 (designer consistency) → P3 (end-user experience)**

**Rationale**:
- P1 (Form components): buttons, inputs, cards — most frequently used, highest impact
- P2 (Feedback components): badges, tooltips, toasts — lower impact, can follow safely
- P3 (Complex layout): modals, tabs, dialogs — used in specific contexts, can wait
- Staged rollout allows testing each batch independently and catching issues early

**Dependency**: Earlier user stories don't depend on later ones. P1 components can ship independently.

**Alternatives considered**:
- All at once (big-bang): risky; hard to debug; violates Constitution II (simple)
- Random order: unpredictable; hard to plan; design inconsistencies surface late

---

## Decision 6: Token Coverage & Deprecation

**Question**: What happens to hardcoded values in old components? How do we ensure 100% coverage?

**Decision**: **Audit pass to identify hardcoded values → gradual refactor per story → deprecate non-conforming components**

**Rationale**:
- Initial audit (research phase) catalogs all hardcoded values and their corresponding tokens
- Refactoring per user story converts components incrementally
- After Phase 3, any hardcoded values are consciously deprecated or flagged as technical debt

**Implementation**:
- Audit script: search for hardcoded colors (`#` hex), sizes (`px`), etc.
- Track findings in issues/tickets per component
- Success metric: 100% of active components use tokens (SC-001)

**Alternatives considered**:
- Aggressive deprecation: breaking changes; risky
- No plan: achieves zero enforcement; components drift over time

---

## Summary Table

| Decision | Resolution | Trade-offs |
|----------|-----------|-----------|
| **Token Format** | CSS custom properties + optional TS exports | Simple implementation, zero runtime cost |
| **Theme Switching** | CSS attribute + localStorage + system preference | Instant updates, persistent, accessible |
| **Token Naming** | `--[category]-[property]-[variant]` | Self-documenting, prevents collisions |
| **File Organization** | Separate per category, re-exported from index | Easy navigation, scales well |
| **Refactoring Order** | By user story priority (P1 → P2 → P3) | Staged rollout, independent testing |
| **Coverage Enforcement** | Audit + gradual refactor + post-Phase 3 check | Achieves 100% coverage, Constitution compliant |

---

## Next Steps

1. **Phase 1**: Use research decisions to design data model and contracts
2. **Phase 1**: Implement token definitions and theme switching infrastructure
3. **Phase 2**: Refactor components per user story following the priority order above
4. **Phase 3**: Audit and verify 100% token coverage and WCAG compliance
