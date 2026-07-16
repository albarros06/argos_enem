# Implementation Plan: Argos — Redações da Semana

**Branch**: `002-redacoes-semana` | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-redacoes-semana/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Redações da Semana adds a weekly curated essay challenge to Argos. An admin publishes a
weekly theme (enunciado + optional support content) via a protected `/admin` panel;
the theme is live for 7 days (extensible/closeable). Premium subscribers submit essays
through the existing upload flow — the submission is linked to the active theme and
consumes a credit normally. A public ranking of the top 50 participants (by total ENEM
score) is visible to all visitors; premium subscribers also see their own position
outside the top 50. The ranking disappears when the theme closes; students retain a
per-theme position history.

Technical approach: extend the existing Next.js application with a new `weekly` module
and a protected `/admin` route group. Three new Prisma models (`WeeklyTheme`,
`WeeklyThemeContent`, `WeeklyThemeEntry`) store the feature data. A `role` field on
`User` guards admin access via Next.js middleware. Support file uploads reuse the
existing R2 presigned-URL pattern. Ranking is computed at query time (real-time JOIN);
final ranks are persisted at closure. Auto-close is handled by a new interval in the
existing `instrumentation.ts` sweep.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS (same as base project)

**Primary Dependencies**: Next.js 15 (App Router), Prisma ORM, Auth.js (session +
role check in middleware), `@aws-sdk/client-s3` for presigned R2 URLs (admin file
upload reuses existing pattern). No new external dependencies.

**Storage**: PostgreSQL 16 (new models: `WeeklyTheme`, `WeeklyThemeContent`,
`WeeklyThemeEntry`; `User.role` addition); Cloudflare R2 (admin support files — same
bucket, `weekly-themes/` prefix, no auto-deletion unlike essay images)

**Testing**: Vitest (unit: ranking computation, entry lifecycle, auto-close logic);
integration: admin API routes against test Postgres; Playwright: not extended (admin
panel is out of scope for the existing E2E happy path; student ranking view is
public-read-only, no new credentials needed)

**Target Platform**: Linux server (same long-running Node process); new pages are
responsive (mobile-first, students access ranking from phones)

**Project Type**: Web application — additions to existing single Next.js project

**Performance Goals**: Ranking query delivers top-50 result < 500 ms at v1 scale
(hundreds of participants per theme, indexed JOIN); admin metrics page < 2 s

**Constraints**: No new infrastructure (Constitution II); auto-close must complete
within 5 min of deadline (SC-003); file uploads max 20 MB (per-file); one active theme
at a time (enforced in module, not DB constraint to allow atomic close-then-publish
in the future)

**Scale/Scope**: 3 new DB tables; 1 new Prisma module (`weekly`); ~10 new API
endpoints; 4 new pages (2 student-facing, 2 admin); middleware extension for role
check; instrumentation extension for auto-close sweep

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Código Legível Primeiro | ✅ PASS | New `weekly` module with single-responsibility files (`theme.ts`, `ranking.ts`, `entry.ts`, `metrics.ts`); admin routes delegate to module — no business logic in handlers. |
| II. Estrutura Simples | ✅ PASS | Zero new external services; reuses R2, PostgreSQL, Auth.js already in place. Auto-close added to existing `instrumentation.ts` sweep, not a new cron/queue. |
| III. Modularidade Obrigatória | ✅ PASS | New `weekly` module with public `index.ts` interface; admin routes and student routes both call through it. Submission module's public interface is extended minimally (`weeklyThemeId` option). No cross-module internal access. |
| IV. Manutenibilidade como Prioridade | ✅ PASS | Ranking is a plain indexed query; final ranks persisted at closure (no recomputation on historical reads). Role check centralized in middleware (single source of truth for admin auth). |
| V. Preparado para Escala | ✅ PASS | Ranking query is stateless and scoped by index; real-time at v1, materialization can be added later behind the `weekly.ranking` interface without restructuring. No global mutable state added. |

**Initial gate: PASS** | **Post-design re-check: PASS** — data model and contracts
introduce no extra projects, layers, or speculative abstractions.

## Project Structure

### Documentation (this feature)

```text
specs/002-redacoes-semana/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── api.md           # HTTP API contract (extensions to base contract)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (additions to existing repository)

```text
src/
├── app/
│   ├── (app)/
│   │   └── redacoes-semana/
│   │       ├── page.tsx              # active theme + public ranking page
│   │       └── historico/
│   │           └── page.tsx          # student participation history
│   ├── (admin)/                      # new layout group — admin auth guard
│   │   ├── layout.tsx                # checks session.user.role = ADMIN
│   │   └── admin/
│   │       ├── page.tsx              # redirect → /admin/redacoes-semana
│   │       ├── redacoes-semana/
│   │       │   └── page.tsx          # theme list, create, lifecycle controls
│   │       └── metricas/
│   │           └── page.tsx          # general app metrics dashboard
│   └── api/
│       ├── admin/
│       │   ├── weekly-themes/
│       │   │   ├── route.ts          # GET list, POST create
│       │   │   └── [id]/
│       │   │       ├── route.ts      # GET detail, PATCH lifecycle
│       │   │       ├── metrics/
│       │   │       │   └── route.ts  # GET theme metrics
│       │   │       ├── content-upload-url/
│       │   │       │   └── route.ts  # POST presigned upload URL
│       │   │       └── contents/
│       │   │           ├── route.ts  # POST register content after upload
│       │   │           └── [contentId]/
│       │   │               └── route.ts  # DELETE content item
│       │   └── metrics/
│       │       └── route.ts          # GET general app metrics
│       └── weekly-themes/
│           ├── active/
│           │   ├── route.ts          # GET active theme + ranking (public)
│           │   └── my-entry/
│           │       └── route.ts      # GET authenticated user's rank + entry
│           └── history/
│               └── route.ts          # GET student participation history
└── modules/
    └── weekly/                       # new module — single responsibility
        ├── index.ts                  # public interface (re-exports)
        ├── theme.ts                  # publish, close, extend, auto-close sweep
        ├── ranking.ts                # live ranking query, finalRank computation
        ├── entry.ts                  # create/delete entry, set displayAs
        └── metrics.ts               # theme metrics + general app metrics queries

prisma/
└── schema.prisma                     # add UserRole enum, WeeklyTheme,
                                      # WeeklyThemeContent, WeeklyThemeEntry,
                                      # User.role field
```

**Changed files** (existing):
- `src/middleware.ts` (new file) — adds `/admin` and `/api/admin` route protection
- `src/modules/submissions/index.ts` — public interface extended with
  `weeklyThemeId?` option in `createSubmission()` and `weeklyDisplayAs?` in
  `confirmSubmission()`
- `src/instrumentation.ts` — adds weekly-theme auto-close interval (every 60 s)

**Structure Decision**: All additions live inside the existing single Next.js project
(Option 1). The new `weekly` module follows the same pattern as the 6 existing modules:
single responsibility, public `index.ts` interface, no internal cross-module access.
The admin panel is a new route group `(admin)/` with a layout that enforces role; it
calls through the existing modules' public interfaces for metrics data.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations — table intentionally empty.*
