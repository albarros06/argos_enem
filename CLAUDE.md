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
