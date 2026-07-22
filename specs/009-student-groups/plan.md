# Implementation Plan: Argos — Grupos de Alunos

**Branch**: `009-student-groups` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-student-groups/spec.md`

## Summary

Any authenticated student can create a group (becoming its leader) and invite up to 29
other students via a shareable invite code, for a 30-person cap including the leader. The
leader proposes one essay theme at a time for the group — enunciado plus optional support
content (text/file) — structurally identical to the global Redação da Semana theme, but
scoped to the group and published by a leader instead of an admin. Members (including the
leader) submit through the existing OCR + grading pipeline with no extra plan/credit
restriction, and see a group-only ranking (real name or anonymous) once evaluated.

Technical approach: a new `groups` module mirrors the existing `weekly` module's shape
(theme/content/entry/ranking) one-for-one, but keyed by group and without the deadline/
auto-close machinery — the leader closes themes manually, so no new cron sweep is needed.
Five new Prisma models (`Group`, `GroupMember`, `GroupTheme`, `GroupThemeContent`,
`GroupThemeEntry`) store the feature data. `submissions/index.ts` gains a `groupThemeId?`
branch parallel to its existing `weeklyThemeId?` branch, checking group membership instead
of subscription tier. The bottom mobile nav's reserved 4th slot becomes a "Grupos" tab.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS (same as base project)

**Primary Dependencies**: Next.js 15 (App Router), Prisma ORM, Auth.js (session), Zod
(validation), `@aws-sdk/client-s3` for presigned R2 URLs (theme support-file upload reuses
the existing weekly-content presign pattern). No new external dependencies — invite codes
use Node's built-in `crypto` module, already imported elsewhere in the codebase.

**Storage**: PostgreSQL via Prisma (5 new models: `Group`, `GroupMember`, `GroupTheme`,
`GroupThemeContent`, `GroupThemeEntry`); Cloudflare R2 for theme support files (same
bucket, `group-themes/` prefix, no auto-deletion — same convention as `weekly-themes/`).

**Testing**: Vitest (unit: `tests/unit/groups`, mirroring `tests/unit/weekly`; integration:
`tests/integration/groups.test.ts` against test Postgres); Playwright not extended (no new
credentialed E2E happy path beyond what group creation/join/submit already covers via
existing submission flow tests).

**Target Platform**: Server-rendered web app (Next.js) on Linux/serverless (Vercel).

**Project Type**: Web application — additions to the existing single Next.js project.

**Performance Goals**: Group ranking query (≤30 participants) resolves well under the
existing 500 ms budget used for the 50-participant global ranking (SC-004: reflected within
1 minute of evaluation, same as the global feature — no new performance envelope).

**Constraints**: Reuse the existing 10 MB submission upload limit, OCR quality gate, and
20 MB support-file limit (same as `weekly` content). One active theme per group at a time,
enforced in the module (same non-DB-constraint pattern as `WeeklyTheme`, for the same
future-proofing reason). Group cap 30 participants (leader + members); 5 groups per student
as a member, unlimited as leader (FR-004, FR-005).

**Scale/Scope**: 5 new DB tables; 1 new Prisma module (`groups`); ~13 new API endpoints;
3–4 new pages under `(app)/groups/`; a 2-field extension to the existing submissions
contract (`groupThemeId`, `groupDisplayAs`); one nav-label change (already staged).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| I. Código Legível Primeiro | PASS — `groups` module files stay single-purpose (`group.ts`, `theme.ts`, `content.ts`, `entry.ts`, `ranking.ts`, `views.ts`), mirroring `weekly`'s already-reviewed shape; no clever constructs. |
| II. Estrutura Simples (YAGNI) | PASS — zero new dependencies; reuses R2, Postgres, Auth.js, the existing presign pattern, and the existing submission/grading pipeline unchanged. No deadline/auto-close machinery is built since the spec has none — avoids the one piece of `weekly` (cron sweep) this feature doesn't need. Leadership transfer is explicitly out of scope (deferred), not half-built. |
| III. Modularidade Obrigatória | PASS — new `groups` module with a public `index.ts` interface; `submissions/index.ts` only imports the public entry/membership functions it needs (parallel to its existing `weekly` import), no reach into `groups` internals. |
| IV. Manutenibilidade | PASS — one ranking/entry lifecycle pattern is reused (copy of the already-proven `weekly` shape) instead of inventing a second one; final ranks persisted at manual closure, avoiding recomputation on historical reads. |
| V. Preparado para Escala | PASS — ranking stays a stateless indexed query scoped by `themeId`; group cap (30) and per-student membership cap (5) bound query size structurally; no shared mutable state added. |

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/009-student-groups/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── api.md            # HTTP API contract (extension to base + weekly contracts)
├── checklists/
│   └── requirements.md   # Spec quality checklist (from /speckit-specify)
└── tasks.md              # Phase 2 output (/speckit-tasks command — NOT created by /speckit-plan)
```

### Source Code (additions to existing repository)

```text
src/
├── app/
│   └── (app)/
│       ├── groups/
│       │   ├── page.tsx                  # list groups led/joined + "create group" form
│       │   ├── join/
│       │   │   └── [code]/page.tsx       # join-by-invite-link landing page
│       │   └── [id]/
│       │       └── page.tsx              # group detail: members, active theme, ranking,
│       │                                 # leader-only controls (propose/close theme,
│       │                                 # remove member, regenerate invite, delete group)
│       └── BottomTabBar.tsx              # fill reserved 4th slot: {href:"/groups", label:"Grupos"}
├── app/
│   └── api/
│       └── groups/
│           ├── route.ts                  # GET list mine, POST create
│           ├── join/
│           │   └── route.ts              # POST {inviteCode} → join
│           └── [id]/
│               ├── route.ts              # GET detail, DELETE (leader)
│               ├── invite/
│               │   └── route.ts          # POST regenerate (leader)
│               ├── members/
│               │   └── [userId]/
│               │       └── route.ts      # DELETE remove member (leader)
│               └── themes/
│                   ├── route.ts          # POST propose theme (leader)
│                   └── [themeId]/
│                       ├── route.ts      # PATCH close (leader)
│                       ├── content-upload-url/
│                       │   └── route.ts  # POST presigned URL (leader)
│                       └── contents/
│                           ├── route.ts  # POST register content (leader)
│                           └── [contentId]/
│                               └── route.ts  # DELETE content item (leader)
└── modules/
    └── groups/                           # new module, mirrors weekly/ shape
        ├── index.ts                      # public interface (re-exports)
        ├── group.ts                      # create, join, listForUser, removeMember,
        │                                 # regenerateInvite, deleteGroup, cap checks
        ├── theme.ts                      # proposeTheme, closeTheme (no auto-close sweep)
        ├── content.ts                    # presignContentUpload, addContent, deleteContent,
        │                                 # getThemeContents — same shape as weekly/content.ts
        ├── entry.ts                      # createEntry, deleteEntry, setDisplayAs
        ├── ranking.ts                    # getLiveRanking, computeAndStoreFinalRanks
        └── views.ts                      # composed view helpers for pages/API responses

prisma/
└── schema.prisma                         # add Group, GroupMember, GroupTheme,
                                          # GroupThemeContent, GroupThemeEntry,
                                          # GroupThemeStatus/GroupContentKind/GroupFileKind/
                                          # GroupDisplayAs enums

tests/
├── unit/groups/                          # mirrors tests/unit/weekly
├── integration/groups.test.ts            # mirrors tests/integration/weekly-admin.test.ts
```

**Changed files** (existing):
- `src/modules/submissions/index.ts` — public interface extended with `groupThemeId?`
  option in `createSubmission()` (branch parallel to the existing `weeklyThemeId?` branch,
  checking group membership instead of subscription tier) and `groupDisplayAs?` in
  `confirmSubmission()`.
- `src/app/(app)/BottomTabBar.tsx` — reserved 4th tab becomes `{ href: "/groups", label:
  "Grupos" }` (slot already emptied on this branch, see prior commit).
- `src/modules/auth/deletion.ts` — account deletion sequence gains: remove the user's
  `GroupMember` rows and `GroupThemeEntry` rows (cascade via schema `onDelete: Cascade`,
  same as `WeeklyThemeEntry`); groups the user **leads** are left in place with
  `leaderId` set to `null` via `onDelete: SetNull` (matches the spec's "líder inativo" edge
  case — no automatic transfer or deletion).

**Structure Decision**: All additions live inside the existing single Next.js project
(Option 1). The new `groups` module is a direct structural copy of the already-reviewed
`weekly` module (same file-per-responsibility split), minus the deadline/auto-close pieces
`weekly` needs and this feature doesn't. Student-facing pages live entirely under the
existing `(app)/` route group — no new `(admin)`-style layout is needed, since "leader" is
a per-group relationship on an ordinary authenticated user, not a global role; leader-only
UI is conditionally rendered within `(app)/groups/[id]/page.tsx` rather than split into a
separate route.

## Complexity Tracking

> No Constitution Check violations — this section intentionally left empty.
