# Research: Animação de Abertura do Olho na Tela de Login

**Date**: 2026-07-22 | **Plan**: [plan.md](./plan.md)

No `[NEEDS CLARIFICATION]` markers remained in the Technical Context, so this phase documents
the concrete technical decisions made and the alternatives rejected, rather than resolving
open unknowns.

## Decision: Port the mockup as CSS `@keyframes`, not a JS animation library

**Rationale**: The reference mockup (`Login Intro.dc.html`) already implements the entire
animation with four `@keyframes` blocks (`eyeLidOpen`, `irisIn`, `introOverlayFade`,
`browLift`) driving `transform`/`opacity` on plain `<div>`s — no SVG, no canvas, no JS-driven
frame loop. Porting it 1:1 into a CSS module keeps the same visual fidelity with zero new
dependencies, satisfying Constitution II (YAGNI) and FR-006 (no third-party animation
library).

**Alternatives considered**:
- **Lottie/After Effects export**: would reproduce the same visual more richly, but requires
  a new runtime dependency and an asset pipeline this project has never needed before — no
  concrete value over the existing mockup's fidelity to justify it.
- **Framer Motion / React Spring**: would let the intro be driven by React state instead of
  pure CSS, but the mockup's timeline is already static (no user input, no interruption
  handling needed), so a JS animation library adds an API surface with no behavior it enables
  that CSS keyframes don't already cover here.

## Decision: `prefers-reduced-motion` handled via a CSS media query, with a matching JS check only to decide *duration* of the auto-dismiss timer

**Rationale**: The visual swap between animated and static end-state (FR-004) is expressed
purely in CSS (`@media (prefers-reduced-motion: reduce)` overriding the animations to their
final frame / `animation: none`) — no JS branch needed for that part. The one place JS is
still needed is deciding how long to keep the overlay mounted before removing it from the DOM
(see next decision): under reduced motion there's no animation to wait for, so the component
reads `window.matchMedia('(prefers-reduced-motion: reduce)').matches` once on mount purely to
pick a much shorter (near-zero) dismiss delay instead of the ~2s cycle.

**Alternatives considered**:
- **Server-side detection via a request header**: no standard HTTP header exposes reduced-
  motion preference; this is a client-only signal (media query), so it must be read in the
  browser regardless of rendering strategy.

## Decision: Auto-dismiss via a `setTimeout` matched to the CSS animation's total duration, then unmount

**Rationale**: FR-003/FR-005 require the overlay to disappear on its own, without blocking or
waiting on the login form's own load, and to respect a hard ceiling (SC-001) independent of
how long the rest of the page takes. Because the animation's duration is fixed and known at
author time (mirroring the mockup's fixed 2s timeline), a single `setTimeout` sized to that
duration (plus a small buffer under the SC-001 ceiling) is sufficient to unmount the overlay
component — simpler and more predictable than listening for `animationend` on multiple
elements (the mockup drives 4 separate keyframe animations with different durations/delays)
and reconciling which one is "last."

**Alternatives considered**:
- **`animationend` event listener**: more "reactive" to the actual animation, but with four
  independently-animated elements it either requires listening on all four and taking the
  last, or arbitrarily picking one — more moving parts for identical real-world behavior,
  since the timeline is fixed and never varies at runtime.
- **CSS-only dismiss (no unmount, just `opacity:0; pointer-events:none` via the existing
  `introOverlayFade` keyframe)**: almost works, since the mockup's own `introOverlayFade`
  already sets `pointer-events:none` at 100%, but leaving the (now invisible) overlay div in
  the DOM permanently is unnecessary weight and a11y noise (a full-viewport `position:absolute`
  element sitting over the form, even non-interactive) for no benefit — unmounting via the
  timeout is one extra state flag with a clear ceiling.

## Decision: Render `<LoginIntro />` from `login/page.tsx` only, not `(auth)/layout.tsx`

**Rationale**: FR-008 scopes the intro to the login screen exclusively. `(auth)/layout.tsx` is
shared by `login`, `register`, `forgot-password`, `reset-password`, and `verify-email` — adding
the component there would leak it onto all five. Placing it as a sibling inside
`login/page.tsx` (which is the one page in scope) keeps the change local to exactly the route
that needs it, per Constitution III (module boundaries) — no other page's code or shared
layout is touched.

**Alternatives considered**:
- **A route-specific layout `login/layout.tsx` wrapping just the login page**: functionally
  equivalent but adds a file/indirection layer for no behavior the sibling-component approach
  doesn't already provide — rejected as unnecessary structure per Constitution II.
