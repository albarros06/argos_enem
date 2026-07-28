# Implementation Plan: Animação de Abertura do Olho na Tela de Login

**Branch**: `013-eye-blink-splash` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-eye-blink-splash/spec.md`

## Summary

The Argos login screen gains a ~2-second brand intro: a full-screen overlay where a brow
lifts, an eye-shaped lid blinks through a few cycles and settles open, the iris zooms in
slightly, and the overlay dissolves to reveal the login form (already mounted underneath,
loading in parallel). The composition and timing are taken directly from an existing Claude
Design mockup (`Login Intro.dc.html`, project "Friendly eye blinking animation") rather than
designed from scratch. Scope is the login screen only — no other `(auth)` page (register,
forgot-password, etc.) gets this intro.

Technical approach: a new client component (`LoginIntro`) rendered only from
`src/app/(auth)/login/page.tsx`, driven entirely by CSS `@keyframes` (mirroring the mockup's
`eyeLidOpen`/`irisIn`/`browLift`/`introOverlayFade` animations) using the project's existing
design tokens (`--color-primary-brand`, `--color-surface-fg`, `--shadow-glow`, etc. — all
already defined in `src/styles/tokens.css`, confirmed to match the mockup's token names
exactly). No new dependency. `prefers-reduced-motion` is read once on mount to choose between
the animated and static (end-state) markup — pure CSS media query, no JS animation library.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS (same as base project)

**Primary Dependencies**: Next.js 15 (App Router), React. No new dependency — animation is
CSS-only (`@keyframes`/`transform`/`opacity`), matching how the rest of the app's motion
(button press, tab transitions) is already implemented.

**Storage**: N/A — purely presentational, no data persisted.

**Testing**: The project's Vitest setup runs in a Node environment with no DOM/component-
testing tooling (no jsdom, no `@testing-library/*`) — it tests server-side modules and API
routes, not rendered UI. This feature has no server module, no API surface, and no business
logic; its correctness is visual (does the animation look and time right, does it appear only
on `/login`). Per Constitution I/II, adding a DOM-testing stack for one cosmetic component
would be new-dependency overhead disproportionate to the value, so verification here is:
`tsc --noEmit` + `eslint` (structural correctness) plus manual browser verification (visual/
timing correctness) — consistent with how the project already treats presentational-only
changes (e.g., the `009-student-groups` and nav-fix work in this session relied on the same
combination for CSS-only changes).

**Target Platform**: Server-rendered web app (Next.js) on Linux/serverless (Vercel), rendered
client-side in the browser (all major browsers + mobile Safari/Chrome).

**Project Type**: Web application — addition to the existing single Next.js project.

**Performance Goals**: Zero perceptible added load latency (SC-004) — the component is a few
KB of CSS/JSX shipped with the already-client-rendered login page bundle, no new network
requests, no blocking of the login form's own mount.

**Constraints**: Total animation cycle capped at ~2.5s (SC-001) regardless of how long the
underlying login form takes to become interactive; must degrade to a static end-state under
`prefers-reduced-motion`; must not appear on any `(auth)` route other than `/login`.

**Scale/Scope**: One new client component + one CSS module; a one-line change to
`src/app/(auth)/login/page.tsx` to render it. No new routes, no new API, no schema changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| I. Código Legível Primeiro | PASS — one small, single-purpose component (`LoginIntro`); CSS keyframes named descriptively after the mockup's own naming (`eyeLidOpen`, `irisIn`, `browLift`, `introOverlayFade`); no clever tricks. |
| II. Estrutura Simples (YAGNI) | PASS — zero new dependencies; reuses existing design tokens; no animation library, no new test tooling. Scope explicitly bounded to the login screen (not generalized into a reusable "app splash" system nobody asked for yet). |
| III. Modularidade Obrigatória | PASS — `LoginIntro` is self-contained (own file + own CSS module), imported only by `login/page.tsx`; it does not reach into or modify the shared `(auth)/layout.tsx` used by other auth pages, keeping the blast radius to exactly the one screen in scope. |
| IV. Manutenibilidade | PASS — animation timing/composition lives in one CSS module mirroring the source-of-truth mockup 1:1, so future changes have a single place to look; no duplicated keyframe logic. |
| V. Preparado para Escala | PASS (N/A pressure) — purely client-rendered presentational component; no shared mutable state, no server load implication either way. |

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/013-eye-blink-splash/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command) — N/A content (no data)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md   # Spec quality checklist (from /speckit-specify)
└── tasks.md              # Phase 2 output (/speckit-tasks command — NOT created by /speckit-plan)
```

No `contracts/` directory — this feature exposes no API/CLI/library surface (pure UI).

### Source Code (additions to existing repository)

```text
src/
└── app/
    └── (auth)/
        ├── layout.tsx                 # UNCHANGED — shared shell for all auth pages
        └── login/
            ├── page.tsx               # CHANGED — renders <LoginIntro /> once, above the form
            ├── LoginIntro.tsx         # NEW — client component: reads prefers-reduced-motion,
            │                          # renders animated or static markup, removes itself
            │                          # from the DOM after the cycle completes
            └── LoginIntro.module.css  # NEW — @keyframes eyeLidOpen/irisIn/browLift/
                                        # introOverlayFade, ported from the Login Intro.dc.html
                                        # mockup, using existing design tokens
```

**Changed files** (existing):
- `src/app/(auth)/login/page.tsx` — imports and renders `<LoginIntro />` as a sibling above
  the existing `<LoginForm />`, so the form still mounts and becomes interactive immediately;
  the intro is purely an overlay on top of it, per FR-005.

**Structure Decision**: The component lives inside `login/` (not `(auth)/`) specifically
because the spec scopes the intro to the login screen only (FR-008) — placing it in the
shared `(auth)/layout.tsx` would leak it onto register/forgot-password/reset-password/
verify-email, which is explicitly out of scope. This keeps the change's blast radius to a
single route, matching Constitution III (module boundaries) and II (no speculative reuse).

## Complexity Tracking

> No Constitution Check violations — this section intentionally left empty.
