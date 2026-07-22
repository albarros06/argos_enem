---
description: "Task list for Animação de Abertura do Olho na Tela de Login"
---

# Tasks: Animação de Abertura do Olho na Tela de Login

**Input**: Design documents from `/specs/013-eye-blink-splash/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: NOT included — per plan.md's Technical Context, this feature has no server module,
no API surface, and no business logic; the project's Vitest setup has no DOM/component-testing
tooling (no jsdom, no `@testing-library/*`), and adding one for a single cosmetic component
would be a new-dependency cost disproportionate to the value (Constitution II). Verification is
`tsc --noEmit` + `eslint` (structural) plus the manual browser checklist in `quickstart.md`
(visual/timing correctness).

**Organization**: Tasks are grouped by user story (US1 → US3, priority order from spec.md).
US1 is the MVP (the intro itself); US2 and US3 are increments on top of the same two files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (Setup and Polish have no story label)

## Path Conventions

Single Next.js web app. All changes are under `src/app/(auth)/login/`.

---

## Phase 1: Setup

**Purpose**: Confirm the existing design system already covers everything this feature needs.

- [X] T001 Confirm `src/styles/tokens.css` already defines `--color-primary-brand`,
      `--color-surface-fg`, `--color-text-on-brand`, and `--shadow-glow` (all used by the
      mockup) — no new tokens required.

**Checkpoint**: No new tokens/dependencies needed; ready to build the component.

---

## Phase 2: Foundational

Not applicable — `src/app/(auth)/login/page.tsx` and the shared `(auth)/layout.tsx` already
exist and need no structural change beyond what US1 does directly. No blocking prerequisites.

---

## Phase 3: User Story 1 - A marca "acorda" na tela de login (Priority: P1) 🎯 MVP

**Goal**: The login screen shows the ~2s eye-blink intro overlay (ported from the
`Login Intro.dc.html` mockup) on top of the login form, which loads underneath in parallel and
becomes usable the moment the overlay auto-dismisses.

**Independent Test**: Open `/login` directly and observe the overlay play through its full
cycle (brow, blinking eyelid, iris zoom, dissolve) and disappear on its own within ~2 seconds,
revealing a fully usable login form — no click required.

### Implementation for User Story 1

- [X] T002 [P] [US1] Create `src/app/(auth)/login/LoginIntro.module.css`: port the mockup's
      four `@keyframes` (`eyeLidOpen`, `irisIn`, `browLift`, `introOverlayFade`) and the
      brow/eyelid/iris/overlay element styles 1:1, using the existing design tokens confirmed
      in T001 (no new colors/values invented).
- [X] T003 [US1] Create `src/app/(auth)/login/LoginIntro.tsx`: a client component that renders
      the overlay markup (brow, eyelid containing the iris, "Argos" wordmark) wired to the
      classes from `LoginIntro.module.css`; on mount, starts a single timer sized to the
      animation's total duration (capped under the SC-001 ceiling of ~2.5s) and unmounts the
      overlay when it elapses, per FR-003.
- [X] T004 [US1] In `src/app/(auth)/login/page.tsx`, render `<LoginIntro />` as a sibling
      above the existing `<LoginForm />`, so the form still mounts and is interactive
      immediately underneath the overlay, per FR-005 (depends on T002, T003).

**Checkpoint**: The login screen shows the branded intro and reveals a fully working form on
its own — independently demoable.

---

## Phase 4: User Story 2 - A introdução não vaza para outras telas (Priority: P2)

**Goal**: The intro is exclusive to `/login` — it never appears on other `(auth)` pages
(register, forgot-password, reset-password, verify-email) nor on any app screen after a
successful login, and it replays on every fresh load of `/login` itself.

**Independent Test**: Log in successfully and confirm the intro never reappears on the
dashboard or any other screen; visit `/register`, `/forgot-password`, `/reset-password`, and
`/verify-email` directly and confirm none of them show it; reload `/login` and confirm it
plays again from the start.

### Implementation for User Story 2

- [X] T005 [US2] Verify, per `quickstart.md`'s manual checklist, that `LoginIntro` is imported
      only from `src/app/(auth)/login/page.tsx` (T004) and nowhere else — in particular not
      from `src/app/(auth)/layout.tsx` (shared by all auth pages) and not from any `(app)/`
      route. No new code is expected if T004 was scoped correctly; if a leak is found here,
      fix by removing any stray import outside `login/page.tsx`.

**Checkpoint**: The intro's blast radius is confirmed to be exactly one route.

---

## Phase 5: User Story 3 - Aluno com sensibilidade a movimento (Priority: P3)

**Goal**: A user with `prefers-reduced-motion` enabled sees the brand mark in its final state
(eye open, brow settled) with no blink/zoom/fade motion, and reaches the login form without
waiting out the normal animation cycle.

**Independent Test**: Enable "reduce motion" in OS/browser settings, open `/login`, and
confirm the mark appears static (no animation) with the form available immediately, no layout
break.

### Implementation for User Story 3

- [X] T006 [US3] In `LoginIntro.tsx` (from T003), read
      `window.matchMedia('(prefers-reduced-motion: reduce)').matches` once on mount to choose
      between the animated class and a static end-state class, and to pick a near-zero
      dismiss delay instead of the full ~2s cycle, per FR-004 (depends on T003).
- [X] T007 [P] [US3] In `LoginIntro.module.css` (from T002), add the static end-state rules
      (final brow/eyelid/iris positions and full opacity, no `@keyframes` iteration) applied
      via the class toggled in T006, plus a `@media (prefers-reduced-motion: reduce)` override
      as defense-in-depth for any consumer that renders the animated markup directly.

**Checkpoint**: All three user stories are independently functional; reduced-motion users are
fully covered.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification and quality gates; no new user-facing behavior.

- [X] T008 [P] Run `npx tsc --noEmit` and `npm run lint` on the new/changed files; fix any
      issues.
- [ ] T009 Execute the `specs/013-eye-blink-splash/quickstart.md` manual checklist end to end
      in a real browser (happy path, scope containment, reduced motion, network-throttled
      resilience).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: N/A for this feature.
- **User Stories (Phase 3–5)**: All build on the same two files (`LoginIntro.tsx`,
  `LoginIntro.module.css`) created in US1.
  - US1 (P1) has no dependency on US2/US3 and is independently shippable as-is (it already
    respects a max-duration ceiling even without US3's reduced-motion handling).
  - US2 (P2) is a verification-only pass on top of US1 — no new code expected.
  - US3 (P3) extends the two files US1 created; run after US1 lands.
- **Polish (Phase 6)**: After the desired stories are complete.

### Within Each User Story

- CSS module before/alongside the component that references its classes (T002 before/parallel
  with T003).
- Component before wiring it into the page (T003 before T004).

### Parallel Opportunities

- T002 (CSS module) can be authored in parallel with T003 (component skeleton), reconciling
  class names once both are drafted — both are new files.
- T006 and T007 touch different files (`.tsx` vs `.module.css`) and can be done in parallel
  once T003/T002 exist, provided the class name toggled between them is agreed upfront.
- T008 (lint/typecheck) has no file dependency on T009 (manual browser walkthrough).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (confirm tokens).
2. Phase 3: User Story 1 (the intro itself, capped duration, no reduced-motion handling yet).
3. **STOP and VALIDATE**: open `/login`, confirm the intro plays and dismisses into a working
   form.
4. Demo — the core brand moment is already delivered.

### Incremental Delivery

1. Setup → tokens confirmed.
2. US1 → the intro plays on `/login` and auto-dismisses → demo.
3. US2 → confirm no leak to other screens → demo/verification.
4. US3 → reduced-motion users covered → demo.
5. Polish → lint/typecheck clean, full manual checklist run.

---

## Notes

- [P] = different files, no incomplete dependencies.
- No cron/sweep, no new Prisma models, no new API route — this feature touches exactly two new
  files and one one-line change to an existing page.
- Commit after each task or logical group; this feature is small enough that US1 alone is a
  reasonable single commit if preferred.
