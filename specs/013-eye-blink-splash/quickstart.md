# Quickstart: Animação de Abertura do Olho na Tela de Login

Bring up the app and verify the login-screen intro end to end.

## Prerequisites

- Existing local setup for Argos ENEM (see `specs/001-enem-essay-grading/stack.md`).
- No new env vars, no database migration, no new dependency for this feature.

## Run

```bash
npm run dev
# open http://localhost:3000/login
```

## Manual test — happy path

1. Open `/login` directly (or hard-refresh it). Expect: a full-screen overlay appears
   immediately, in the app's brand color, showing a brow, an eye shape that blinks through a
   few cycles and settles open, with an iris that zooms in slightly as the overlay starts to
   dissolve.
2. Wait without interacting. Expect: within ~2 seconds the overlay fully dissolves and the
   normal login form (e-mail, senha, "Entrar") is visible and usable — no click needed to
   dismiss it.
3. Log in successfully. Expect: the intro does **not** reappear on the dashboard or any other
   app screen.
4. Navigate to `/register`, `/forgot-password`, `/reset-password`, `/verify-email` directly.
   Expect: none of these show the intro — it is exclusive to `/login`.
5. Refresh `/login` again. Expect: the intro plays again from the start (each full page load
   is independent — no "seen it already" state persists across reloads).

## Manual test — reduced motion

1. Enable "reduce motion" in the OS/browser accessibility settings.
2. Open `/login`. Expect: the brand mark appears in its final state (eye open, brow settled)
   with no blinking/zoom/fade animation, and the login form is available immediately — no
   extended wait.

## Manual test — resilience

1. Throttle the network to "Slow 3G" (or similar) in devtools and open `/login`. Expect: the
   overlay still resolves within its capped duration (~2.5s) even if the login form's own
   assets are still finishing underneath — it never waits indefinitely for the page to be
   fully ready.

## Automated checks

```bash
npx tsc --noEmit   # structural correctness
npm run lint       # code quality
```

No Vitest coverage is added for this feature — see plan.md's Technical Context/Testing
section for why (no server module, no DOM-testing tooling in this project, purely visual
correctness that the automated suite can't meaningfully assert).
