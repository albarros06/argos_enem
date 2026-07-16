# Tasks: Design System UI Implementation

**Input**: Design documents from `specs/003-design-system-ui/`

**Organization**: Tasks grouped by user story (US1–US3) in priority order. Each story is independently testable after its phase is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Maps to spec.md user stories (US1–US3)

---

## Phase 1: Setup

**Purpose**: Initialize directory structure and establish token infrastructure

- [x] T001 Create directory structure: `src/tokens/`, `src/styles/`, `src/contexts/`, `src/lib/theme.ts`
- [x] T002 Create base token files: `src/tokens/colors.ts`, `src/tokens/typography.ts`, `src/tokens/spacing.ts`, `src/tokens/radii.ts`, `src/tokens/shadows.ts`, `src/tokens/gradients.ts`, `src/tokens/index.ts`
- [x] T003 [P] Create CSS files: `src/styles/tokens.css` (root custom properties) and `src/styles/theme.css` (dark/light overrides)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core design token system and theme switching that ALL user stories depend on

**⚠️ CRITICAL**: No component refactoring can begin until this phase is complete.

- [x] T004 Implement token definitions in `src/tokens/colors.ts` with dark/light variants for all colors (primary, secondary, neutrals, semantic), brand gradient, and borders per DESIGN_SYSTEM.md
- [x] T005 Implement token definitions in `src/tokens/typography.ts` with font families (Space Grotesk, IBM Plex Mono), heading styles (xl–sm with tracking), body styles, labels, and mono per DESIGN_SYSTEM.md
- [x] T006 Implement token definitions in `src/tokens/spacing.ts` with 4px base unit scale: xs (4px), sm (8px), md (12px), lg (24px), xl (32px), 2xl (48px)
- [x] T007 Implement token definitions in `src/tokens/radii.ts` with soft geometric scale (sm: 8px, md: 12px, lg: 18px, xl: 22px, 2xl: 26px, pill: 999px) and component-specific aliases
- [x] T008 Implement token definitions in `src/tokens/shadows.ts` with elevation levels (sm, md, lg) and glow effect (soft violet halo)
- [x] T009 Implement token definitions in `src/tokens/gradients.ts` with brand gradient only (blue→violet: 2E5BFF → 8A3FFE)
- [x] T010 Re-export all tokens from `src/tokens/index.ts` (export default aggregated tokens object)
- [x] T011 Generate/hand-author CSS custom properties in `src/styles/tokens.css` with `--[category]-[property]-[variant]` naming convention for dark theme (root default)
- [x] T012 Generate/hand-author CSS custom property overrides in `src/styles/theme.css` for light theme (`[data-theme="light"]` selector)
- [x] T013 Implement theme switching utilities in `src/lib/theme.ts`: `getThemePreference()`, `setTheme(theme)`, `initTheme()` with localStorage persistence
- [x] T014 Create theme context provider in `src/contexts/ThemeContext.tsx` (optional for components; exposes theme state for components that need it)
- [x] T015 Update `src/app/layout.tsx` root layout: import tokens.css and theme.css, add inline script to initialize theme before render (prevents flash of wrong theme), wrap children in ThemeContext provider
- [x] T016 Add theme toggle component in `src/components/ThemeToggle.tsx`: button to switch between dark/light themes, updates localStorage and `[data-theme]` attribute on document root

**Checkpoint**: ✅ COMPLETE — Design token system is ready. CSS custom properties are defined for both themes. Theme switching infrastructure is in place. No component changes needed yet.

---

## Phase 3: User Story 1 — Developer Builds UI with Design Tokens (Priority: P1) 🎯 MVP

**Goal**: Establish proof-of-concept that developers can build components using only design tokens. Refactor core form components to use tokens exclusively.

**Independent Test**: Create a new button component in `src/components/Button/Button.tsx` using only design tokens (no hardcoded values). Render it in light/dark themes. Verify button uses `--color-primary-brand`, `--space-md`, `--radius-button` tokens. Change a token value globally; verify button updates immediately without code changes.

### Implementation for User Story 1

- [x] T017 [P] [US1] Refactor `src/components/Button/Button.tsx` to use design tokens: replace hardcoded colors with `--color-primary-brand`, spacing with `--space-sm/md/lg`, radius with `--radius-button`
- [x] T018 [P] [US1] Refactor `src/components/Button/Button.module.css` (or equivalent) to use `var(--token-name)` syntax for all color, spacing, radius, and shadow properties
- [x] T019 [P] [US1] Refactor `src/components/Input/Input.tsx` and `Input.module.css` to use tokens: background (`--color-surface-bg`), text (`--color-text-primary`), border (`--color-border-default`), spacing (`--space-sm`), radius (`--radius-input`)
- [x] T020 [P] [US1] Refactor `src/components/Card/Card.tsx` and `Card.module.css` to use tokens: background (`--color-surface-fg`), spacing (`--space-lg`), radius (`--radius-card`), shadow (`--shadow-md`)
- [x] T021 [US1] Create `src/components/Form/Form.tsx` refactored component that uses design tokens for layout and styling; document token usage in component JSDoc
- [x] T022 [US1] Write visual regression test `tests/integration/component-tokens-p1.test.ts`: render Button, Input, Card in dark and light themes; screenshot both and verify consistency with DESIGN_SYSTEM.md
- [x] T023 [US1] Document token usage in `docs/tokens-usage-guide.md`: patterns for using tokens in components, examples from Button/Input/Card, dos and don'ts

**Checkpoint**: Form component foundation (buttons, inputs, cards) uses tokens exclusively. No hardcoded values. Theme switching works seamlessly. Developers have a clear pattern to follow.

---

## Phase 4: User Story 2 — Designer Reviews Component Consistency (Priority: P2)

**Goal**: Extend token coverage to feedback and navigation components. Enable designers to audit UI consistency against design system.

**Independent Test**: Create a component inventory audit script that lists all UI components, their token usage, and any hardcoded values found. Run audit on refactored components; verify 100% token coverage. Compare component rendering to DESIGN_SYSTEM.md; verify all match.

### Implementation for User Story 2

- [x] T024 [P] [US2] Refactor `src/components/Badge/Badge.tsx` and `Badge.module.css` to use tokens: background, text color, spacing, radius (pill or sm)
- [x] T025 [P] [US2] Refactor `src/components/Tooltip/Tooltip.tsx` and `Tooltip.module.css` to use tokens: background, text, shadow (`--shadow-md`), radius, spacing
- [x] T026 [P] [US2] Refactor `src/components/Toast/Toast.tsx` and `Toast.module.css` to use tokens: background (per semantic color), text, shadow (`--shadow-lg`), radius, spacing
- [x] T027 [P] [US2] Refactor `src/components/Tabs/Tabs.tsx` and `Tabs.module.css` to use tokens: borders, text colors, spacing, radius (none typically for tabs)
- [x] T028 [US2] Create audit script `scripts/audit-component-tokens.ts`: scan `src/components/` for hardcoded colors, sizes; generate report of token coverage per component
- [x] T029 [US2] Run audit on P1 + P2 components; document findings in `docs/component-audit-p2.md`
- [x] T030 [US2] Update component storybook (if exists) or create component gallery in `src/app/design-system/components/index.tsx` showing all refactored components in both themes
- [x] T031 [US2] Write visual regression test `tests/integration/component-tokens-p2.test.ts`: render all P2 components (Badge, Tooltip, Toast, Tabs) in dark and light themes; screenshot both

**Checkpoint**: Feedback and navigation components use tokens exclusively. Designer can navigate app and verify consistency. Component gallery provides single source of truth for UI patterns.

---

## Phase 5: User Story 3 — End-User Experiences Cohesive Visual Language (Priority: P3)

**Goal**: Complete token coverage across all components. Ensure all UI elements follow unified visual language. Optimize theme switching for end-user experience.

**Independent Test**: An end-user can navigate the entire application, toggle between dark and light themes instantly, and perceive all UI as cohesive. No visual jarring, no missed components. All buttons feel the same, all cards look coordinated.

### Implementation for User Story 3

- [x] T032 [P] [US3] Refactor `src/components/Modal/Modal.tsx` and `Modal.module.css` to use tokens: background (`--color-surface-fg`), border, radius (`--radius-modal`), shadow (`--shadow-lg`), spacing, typography
- [x] T033 [P] [US3] Refactor `src/components/Dialog/Dialog.tsx` and `Dialog.module.css` to use tokens (same as Modal)
- [x] T034 [P] [US3] Refactor `src/components/Select/Select.tsx` and `Select.module.css` to use tokens: background, border, text, spacing, radius (`--radius-input`)
- [x] T035 [P] [US3] Refactor `src/components/Checkbox/Checkbox.tsx` and `Checkbox.module.css` to use tokens: border, checkmark color, spacing, radius (small)
- [x] T036 [P] [US3] Refactor `src/components/Radio/Radio.tsx` and `Radio.module.css` to use tokens: border, dot color, spacing, radius (pill for outer, none for inner)
- [x] T037 [P] [US3] Refactor `src/components/Switch/Switch.tsx` and `Switch.module.css` to use tokens: background (active: brand, inactive: border), radius (pill), shadow, spacing
- [x] T038 [US3] Run full audit script on all components; generate comprehensive report in `docs/component-audit-p3.md`; ensure 100% token coverage (SC-001)
- [x] T039 [US3] Create theme switching UI (already in T016 ThemeToggle); integrate into app header/navigation so end-users can toggle themes
- [x] T040 [US3] Test theme switch performance: measure time from click to visual update across entire app; target < 100ms (SC-007)
- [x] T041 [US3] Write end-to-end test `tests/e2e/theme-switching.test.ts`: navigate app, toggle theme, verify all components update instantly and visually match both themes

**Checkpoint**: All UI components use tokens. Theme switching is instant and seamless. End-users experience unified visual language across entire app.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality assurance, optimization, and documentation

- [ ] T042 [P] Validate WCAG AA contrast ratios in both dark and light themes: test all color token pairs in production context; fix any failures (SC-006)
- [ ] T043 [P] Performance audit: measure token loading time, CSS parsing, theme switch latency; optimize if needed (SC-007)
- [ ] T044 [P] Create/update design system documentation in `DESIGN_SYSTEM.md`: brand guidelines, token definitions, component guidelines, contribution guide per Constitution
- [ ] T045 [P] Add linting rule to flag hardcoded colors/sizes in new components: custom ESLint rule or Stylelint rule to prevent regressions
- [ ] T046 Update `CLAUDE.md` project context: reference design system documentation and token guidelines for future developers
- [ ] T047 Create deprecation guide for old/hardcoded patterns: document what not to use, what to replace it with
- [ ] T048 Write contribution guide for adding new components: must use tokens, examples, checklist to verify before PR
- [ ] T049 [P] Unit tests for token availability: `tests/unit/tokens.test.ts` verifies all tokens are defined, exported, and accessible via CSS and JS
- [ ] T050 [P] Unit tests for theme switching: `tests/unit/theme.test.ts` verifies `getThemePreference()`, `setTheme()`, localStorage persistence, system preference detection

**Checkpoint**: Design system is production-ready, well-documented, and protected against regressions. New developers have clear guidance for token usage.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3–5 (User Stories)**: Depend on Phase 2 completion; can run in parallel (US1, US2, US3 independent)
- **Phase 6 (Polish)**: Depends on Phases 3–5 completion

### User Story Dependencies

| Story | Can start after | Blocks | Notes |
|---|---|---|---|
| US1 (Developer Tokens) | Phase 2 | US2, US3 (soft) | Proof-of-concept; establishes patterns |
| US2 (Designer Consistency) | Phase 2 + US1 patterns | — | Extends coverage; uses patterns from US1 |
| US3 (End-User Cohesion) | Phase 2 | — | Full rollout; depends on patterns from US1/US2 |

### Parallel Opportunities

**Phase 2**: All token definition tasks (T004–T010) can run in parallel; CSS generation (T011–T012) depends only on T004–T009; theme infrastructure (T013–T016) can run in parallel

**Phase 3 (US1)**: T017–T020 (component refactoring) run in parallel; T022–T023 (tests/docs) depend only on components being ready

**Phase 4 (US2)**: T024–T027 (component refactoring) run in parallel; T028–T031 (audit/tests) depend on refactoring complete

**Phase 5 (US3)**: T032–T037 (component refactoring) run in parallel; T038–T041 (audit/tests) depend on refactoring complete

**Phase 6**: T042–T043, T044–T045, T049–T050 can run in parallel

---

## Parallel Execution Examples

### Phase 2 (Foundational) — Parallel Token Definitions

```
Parallel:
  Task T004: Token definitions (colors.ts)
  Task T005: Token definitions (typography.ts)
  Task T006: Token definitions (spacing.ts)
  Task T007: Token definitions (radii.ts)
  Task T008: Token definitions (shadows.ts)
  Task T009: Token definitions (gradients.ts)

Then sequential: T010 (re-export) → T011–T012 (CSS) → T013–T016 (theme infrastructure)
```

### Phase 3 (US1) — Parallel Component Refactoring

```
Parallel:
  Task T017: Refactor Button
  Task T018: Update Button CSS
  Task T019: Refactor Input + CSS
  Task T020: Refactor Card + CSS

Then sequential: T021 (Form) → T022–T023 (tests/docs)
```

### Phase 4 (US2) — Parallel Component Refactoring

```
Parallel:
  Task T024: Refactor Badge
  Task T025: Refactor Tooltip
  Task T026: Refactor Toast
  Task T027: Refactor Tabs

Then sequential: T028 (audit script) → T029–T031 (audit/tests)
```

### Phase 5 (US3) — Parallel Component Refactoring

```
Parallel:
  Task T032: Refactor Modal
  Task T033: Refactor Dialog
  Task T034: Refactor Select
  Task T035: Refactor Checkbox
  Task T036: Refactor Radio
  Task T037: Refactor Switch

Then sequential: T038 (final audit) → T039–T041 (theme/tests)
```

### Phase 6 (Polish) — Parallel Quality Checks

```
Parallel:
  Task T042: WCAG contrast validation
  Task T043: Performance audit
  Task T044: Documentation
  Task T045: Linting rules
  Task T049: Unit tests (tokens)
  Task T050: Unit tests (theme)

Then sequential: T046–T048 (guides/deprecation/contribution)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only → Form Components)

1. Complete Phase 1 + Phase 2 (infrastructure + tokens)
2. Complete Phase 3 (US1) → developers can build with tokens
3. **STOP and VALIDATE**: form components work in both themes, token system is solid
4. US1 alone is deployable as foundation

### Incremental Delivery

1. **Weeks 1–2**: Phase 1 + Phase 2 → token system ready
2. **Weeks 3–4**: Phase 3 (US1) → core form components use tokens (MVP ship)
3. **Weeks 5–6**: Phase 4 (US2) → feedback components consistent
4. **Weeks 7–8**: Phase 5 (US3) → full app coverage, end-user experience cohesive
5. **Weeks 9–10**: Phase 6 → polish, documentation, linting, tests

Each phase is independently deployable and testable.

---

## Notes

- All task IDs sequenced (T001–T050) with checkpoints after each phase
- `[P]` marks parallelizable tasks within each phase
- `[US#]` clearly maps tasks to user stories for scope/priority management
- File paths are explicit for clarity and to prevent ambiguity
- Phases are blocked on prerequisites but allow parallelization within each phase
- Tests are included but marked optional in template; included here because design system requires visual regression and WCAG verification
- Constitution principles are built into tasks (readable token names, no external services, modular components)
- Success metrics (SC-001–SC-007) are measurable checkpoints verified by tasks
- Final delivery: 100% token coverage, instant theme switching, WCAG AA compliant, fully documented
