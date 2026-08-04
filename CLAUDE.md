<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the active plan:

**Current Feature**: `specs/013-eye-blink-splash/plan.md` (login-screen brand intro — a
~2s full-screen overlay on `/login` only, ported 1:1 from an existing Claude Design mockup:
brow lifts, an eye-shaped lid blinks through a few cycles and settles open, iris zooms in
slightly, overlay dissolves to reveal the login form loading underneath; pure CSS
`@keyframes`, no new dependency; respects `prefers-reduced-motion`; scoped to `login/page.tsx`
only, not the shared `(auth)/layout.tsx`, so it never leaks onto register/forgot-password/etc.).

**Previous Context**: `specs/009-student-groups/plan.md` (student-led groups — any student
creates a group and becomes its leader, others join via invite code/link (cap 30
participants/group, 5 groups/student as member, unlimited as leader); leader proposes one
essay theme at a time (text/file support content), structurally mirroring the global
Redação da Semana theme but scoped to the group; members submit through the existing
OCR + grading pipeline with no extra plan/credit gate; group-only ranking (real name or
anonymous); new `groups` module and 5 Prisma models, no new dependency; contract in
`contracts/api.md`, types in `data-model.md`, setup in `quickstart.md`).
`specs/005-add-pdf-support/plan.md` (single-page PDF essay uploads via
Google Vision `batchAnnotateFiles`). `specs/004-vertex-ai-migration/plan.md` (Gemini grading
via Vertex AI — service-account auth, region `us-central1`). `specs/003-design-system-ui/plan.md`
(design system UI — tokens, theme switching). Base stack: `specs/002-redacoes-semana/plan.md`
and `specs/001-enem-essay-grading/stack.md`; API in `contracts/api.md`.

Project principles: `.specify/memory/constitution.md`.

<!-- SPECKIT END -->

## Pending follow-up: subscription price migration not yet applied to production

Commit `9d5a109` (2026-08-04) changed subscription pricing in code:
`prisma/seed.ts` and `scripts/migrate-plan-pricing.ts` now define entry at
R$19,90 (was R$29,90) and premium at R$29,90 (was R$39,90). This was pushed
directly to `main` and deployed, but **the production database still has the
old prices** — the preview/production UI reads `SubscriptionPlan` rows from
the DB, and neither the Vercel build (`prisma migrate deploy` only applies
schema migrations, not data) nor this session touched them.

To finish the rollout, someone with real `DATABASE_URL` access must run:

```
npx tsx scripts/migrate-plan-pricing.ts
```

This deactivates the current active `entry`/`premium` plans and creates new
ones at the updated price; existing subscribers keep their current
plan/price until they resubscribe or switch (same behavior as the prior
pricing change in #32).

**Why this wasn't done automatically**: `DATABASE_URL` and `DIRECT_URL` are
marked *Sensitive* in this Vercel project, so `vercel env pull` returns them
redacted (`"[SENSITIVE]"`) even to an authenticated CLI session — there is no
way to read the real connection string through Vercel from an agent session.
The migration needs to be run from an environment that already has the real
credential (e.g. a local `.env`, or a human running `vercel env pull`
themselves).
