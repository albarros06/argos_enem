# Implementation Plan: Design System UI Implementation

**Branch**: `003-design-system-ui` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-design-system-ui/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Design System UI Implementation establishes a centralized design token system and refactors all UI components to use tokens exclusively, eliminating hardcoded values and ensuring visual consistency across the Argos application. The system defines tokens for colors (dark/light themes), typography (Space Grotesk + IBM Plex Mono), spacing (4px scale), shapes (8–26px radii), shadows (elevation levels), and gradients (brand blue→violet). All existing components (buttons, inputs, cards, forms, modals, tooltips, badges, tabs, dialogs) will be updated to reference these tokens, enabling theme switching, reducing maintenance overhead, and providing a foundation for scalable design evolution.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS (same as base project)

**Primary Dependencies**: Next.js 15 (App Router), React 19, CSS custom properties (no CSS-in-JS framework required; plain CSS or Tailwind if needed)

**Storage**: N/A (design tokens are static configuration, not runtime data)

**Testing**: Vitest (unit tests for token availability and theme switching), Playwright (visual regression testing for component consistency across themes)

**Target Platform**: Web browser (responsive, mobile-first), light and dark theme support; print/social contexts via light theme variant

**Project Type**: Web application frontend (Next.js); tokens are configuration, not a library

**Performance Goals**: 
- Token loading: no perceptible delay (tokens inline in CSS or preloaded)
- Theme switching: instant visual update (< 100ms transition for all affected elements)
- Component render: no regression from current performance

**Constraints**:
- Constitution II (Estrutura Simples): No new external services or complex infrastructure; tokens delivered via CSS or JavaScript variables
- Constitution I (Código Legível Primeiro): Token names must reveal intent; no cryptic abbreviations
- No breaking changes to existing component APIs (token adoption is internal refactoring)
- WCAG AA contrast ratios mandatory in both themes

**Scale/Scope**:
- 3 new directories: `src/tokens/`, `src/styles/` (tokens + theme CSS)
- ~50–100 existing UI components to refactor (gradual rollout per user story)
- 1 new theme switching mechanism (localStorage + context or CSS attribute)
- 0 new database models or external APIs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Código Legível Primeiro** | ✅ PASS | Token names explicitly reveal purpose: `--color-primary-brand`, `--space-lg`, `--radius-button`. No cryptic abbreviations. Component usage is self-documenting (`color: var(--color-primary-brand)` is clearer than `color: #2E5BFF`). |
| **II. Estrutura Simples** | ✅ PASS | Token system uses only CSS custom properties or JavaScript variables—no external services, design tool integrations, or token generation pipeline. Tokens are static configuration. No speculative abstraction; only the current Argos component palette is tokenized. |
| **III. Modularidade Obrigatória** | ✅ PASS | Token definitions live in `src/tokens/` (single source); components import or reference via CSS. Theme switching is isolated to a single context provider; components don't depend on implementation details of theme switching. |
| **IV. Manutenibilidade como Prioridade** | ✅ PASS | Centralized tokens reduce maintenance burden: updating a color value updates all components using that token. Component refactoring to use tokens is independent per story, allowing incremental review and testing. |
| **V. Preparado para Escala** | ✅ PASS | Token system is stateless and composable. Token definitions don't couple components to a specific rendering technology; CSS variables work across current and future frontend frameworks. Theme data is denormalized (dark/light variants coexist), allowing instant switching without server roundtrips. |

**Initial gate: PASS** | **Post-design re-check: PASS** — refactoring to tokens introduces no new infrastructure, architectural layers, or external dependencies.

## Project Structure

### Documentation (this feature)

```text
specs/003-design-system-ui/
├── plan.md              # This file (/speckit-plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── design-tokens.md # Token format and usage contract
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
src/
├── tokens/
│   ├── colors.ts        # Color tokens (dark/light variants)
│   ├── typography.ts    # Font families, sizes, weights, tracking
│   ├── spacing.ts       # Spacing scale (4px base unit)
│   ├── radii.ts         # Border radius values
│   ├── shadows.ts       # Elevation and glow shadows
│   ├── gradients.ts     # Brand gradient definitions
│   └── index.ts         # Re-export all tokens
├── styles/
│   ├── tokens.css       # CSS custom properties (generated or hand-authored)
│   ├── theme.css        # Dark/light theme variants
│   ├── reset.css        # Normalization (if needed)
│   └── globals.css      # Global styles (minimal)
├── components/
│   ├── Button/          # Refactored to use tokens
│   ├── Input/           # Refactored to use tokens
│   ├── Card/            # Refactored to use tokens
│   ├── Form/            # Refactored to use tokens
│   ├── Modal/           # Refactored to use tokens
│   ├── Tooltip/         # Refactored to use tokens
│   ├── Badge/           # Refactored to use tokens
│   ├── Tabs/            # Refactored to use tokens
│   └── Dialog/          # Refactored to use tokens
├── contexts/
│   └── ThemeContext.tsx # Theme switching provider (dark/light)
├── lib/
│   └── theme.ts         # Theme switching utilities
└── app/
    └── layout.tsx       # Root layout: apply theme CSS class/attribute

tests/
├── unit/
│   └── tokens.test.ts   # Verify all tokens are defined and accessible
└── integration/
    └── theme-switching.test.ts  # Verify theme switch updates all components
```

**Structure Decision**: Single Next.js project (Option 1). Tokens and components live in the same source tree (`src/`). No separate design system package or monorepo needed—the application *is* the customer of the tokens. Token definitions are TypeScript/CSS for developer ergonomics (TypeScript for type safety if using object tokens; CSS for runtime efficiency if using custom properties).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations — table intentionally empty.*

---

## Implementation Phases

### Phase 0: Research & Design Decisions

**Output**: `research.md` with answers to:
- Token format: CSS custom properties vs. JavaScript objects vs. hybrid?
- Theme switching mechanism: localStorage + context, CSS attribute, or URL parameter?
- Token file structure: flat list, hierarchical, or grouped by category?
- Tooling: token generation pipeline (e.g., Style Dictionary) or hand-authored tokens?

### Phase 1: Token Definition & Component Refactoring Foundation

**Output**: 
- `data-model.md` — entities: TokenSet (colors, typography, etc.), Theme (dark/light variants), ThemeContext
- `contracts/design-tokens.md` — token format, naming convention, usage examples
- `quickstart.md` — setup guide for developers to build components using tokens

**Tasks**:
- Define all color, typography, spacing, radius, shadow, gradient tokens
- Implement CSS custom properties or JS token export
- Create theme switching context provider
- Refactor first batch of components (buttons, inputs, cards) as proof-of-concept

### Phase 2: Full Component Refactoring & Testing

**Tasks**:
- Refactor remaining components (forms, modals, tooltips, badges, tabs, dialogs)
- Write visual regression tests for dark/light theme consistency
- Audit entire application for hardcoded values
- Update documentation (CLAUDE.md, component storybook, etc.)

### Phase 3: Verification & Polish

**Tasks**:
- WCAG AA contrast verification across themes
- Performance profiling (token loading, theme switch latency)
- Component consistency audit (comparing UI to DESIGN_SYSTEM.md)
- Deprecate legacy hardcoded color/spacing constants

---

## Key Decisions

1. **Token Format**: CSS custom properties recommended for efficiency and broad browser support. JavaScript objects optional for TypeScript type safety during development.

2. **Theme Switching**: Use Next.js `[data-theme="dark"|"light"]` attribute on document root + CSS variable overrides per theme. Persists to localStorage for user preference.

3. **Incremental Refactoring**: Component updates per user story (P1 → P2 → P3) to allow staged testing and deployment. No big-bang refactor.

4. **Token Naming**: Follow pattern: `--[category]-[property]-[variant]` (e.g., `--color-primary-brand`, `--space-lg`, `--radius-button`).

5. **Backward Compatibility**: Old components can coexist with token-based components during transition. Gradual rollout per story.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Components break during refactoring | High | Test each component independently before merging; maintain parallel old/new implementations if needed |
| Theme switching performance | Medium | Inline tokens in critical CSS or preload; measure time to complete theme switch |
| Token coverage gaps | Medium | Audit codebase for hardcoded values early; prioritize by component usage frequency |
| WCAG contrast failures in light theme | High | Validate contrast ratios in testing before rollout; adjust token values if needed |

---

## Success Metrics (from spec)

- **SC-001**: 100% of UI components use design tokens (zero hardcoded values)
- **SC-002**: Components render correctly in both themes with WCAG AA contrast
- **SC-003**: New features use only tokens without referencing legacy code
- **SC-004**: All interactive elements follow unified visual language
- **SC-005**: Design audit shows 100% alignment with DESIGN_SYSTEM.md
- **SC-006**: All text ≥4.5:1 contrast (normal) or ≥3:1 (large)
- **SC-007**: Theme transitions complete in 150–200ms

---

## Dependencies & Sequencing

- **Phase 0** (research) can proceed independently
- **Phase 1** (tokens + first components) depends on Phase 0 decisions
- **Phase 2** (remaining components) depends on Phase 1 patterns established
- **Phase 3** (verification) depends on all components refactored

No external team dependencies; work is isolated to frontend.
