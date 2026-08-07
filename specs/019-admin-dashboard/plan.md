# Implementation Plan: Admin Dashboard Overhaul

**Branch**: `019-admin-dashboard` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-admin-dashboard/spec.md`

## Summary

Replace the two-page admin panel (weekly-theme manager + a bare totals page) with a new
`src/modules/admin/` module and four dashboard areas: **user search & detail** (with a
credit-grant action), **revenue & subscriptions** (MRR, plan mix, recent payments),
**submission pipeline & grading health** (status/failure/zero-reason/score-distribution
counts), and **growth snapshot** (24h/7d/30d/all-time counts). Every admin action is
recorded in a new `AdminActionLog` table. All reads are plain Prisma aggregate queries
(no charts, no time-series storage — v1 is snapshot totals per the spec). The existing
`getAppMetrics` (today living oddly inside the `weekly` module) is retired in favor of the
new module's growth/pipeline/revenue queries, and `/admin/metricas` is replaced by the new
overview at `/admin`.

## Technical Context

**Language/Version**: TypeScript 5 / Node (Next.js 15 App Router, React 19)

**Primary Dependencies**: Prisma (Postgres) for all queries; `zod` for request validation
on the one new mutation endpoint (credit grant); reuses existing `@/lib/auth`
(`requireAdmin`), `@/lib/api` (`handleRoute`, `ApiError`), and `src/modules/credits`
(`grantManualCredits`, `getBalance`). No new dependency.

**Storage**: Postgres via Prisma. One new table, `AdminActionLog` (see data-model.md);
otherwise reads existing `User`, `Submission`, `Evaluation`, `CreditTransaction`,
`Subscription`, `SubscriptionPlan`, `PaymentTransaction` — unchanged.

**Testing**: Vitest (`tests/unit/admin/*.test.ts` for module functions,
`tests/integration/admin-*.test.ts` for the API routes) against the local
`postgres-test` container, matching the existing pattern in `tests/integration/weekly-admin.test.ts`.

**Target Platform**: Vercel (Next.js server components + API routes), same as the rest of the app.

**Project Type**: Web application (single Next.js app; this feature is server-rendered
admin pages + one mutation API route, no new deployable unit).

**Performance Goals**: Every dashboard page load is a handful of indexed aggregate
queries (`count`, `groupBy`, `sum`) — no full-table scans. No specific latency target
beyond the app's existing admin-page norms (these are low-traffic, admin-only pages).

**Constraints**: All pages and the mutation route stay behind the existing
`requireAdmin()` gate (FR-019) — no new auth model. Credit grants MUST reuse the existing
non-expiring `manual_grant` credit kind (FR-009) rather than introduce a new one.

**Scale/Scope**: Admin-only, single-digit concurrent users. One new Prisma model, one new
module (`src/modules/admin/`, ~6 files), ~4 new/changed pages under `(admin)/admin/`, one
new API route (plus one query param addition to an existing pattern for search). No
migration touches existing tables.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Código Legível Primeiro** | PASS. Each admin concern gets its own small named file (`search.ts`, `userDetail.ts`, `revenue.ts`, `pipeline.ts`, `growth.ts`, `auditLog.ts`) — one responsibility each, mirroring the existing `weekly`/`groups` module shape. No clever aggregation tricks; plain Prisma queries. |
| **II. Estrutura Simples** | PASS. No new dependency, no charting library, no time-series storage (explicitly deferred by the spec). Reuses `grantManualCredits`, `getBalance`, `handleRoute`, `requireAdmin` rather than reimplementing. The one schema addition (`AdminActionLog`) is the minimum needed to satisfy FR-010/011 (audit trail), not speculative. |
| **III. Modularidade Obrigatória** | PASS. New `src/modules/admin/` owns all cross-entity admin reporting/actions behind a single `index.ts` public surface; it depends on `credits` and `billing` modules' public exports only, never reaches into their internals. Retiring `getAppMetrics` from `weekly` removes a module boundary violation that already existed (admin-wide totals living inside the weekly-theme module). |
| **IV. Manutenibilidade** | PASS. Centralizing admin reporting in one module — instead of leaving it split between `weekly/metrics.ts` and ad-hoc scripts (`scripts/add-credits.ts`) — is a net reduction in surface area to maintain; the script's logic is superseded by the dashboard action and can be deleted. |
| **V. Preparado para Escala** | PASS. All queries are stateless, indexed aggregate reads issued per-request (no shared mutable state, no singleton cache); the credit-grant write goes through the same transactional path (`prisma.$transaction`) already used by `consumeCredit`/`ensureFreeMonthlyCredit`, so it composes safely with concurrent credit activity. |

No violations → Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/019-admin-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md            # Phase 1 output — new/changed admin endpoints
└── tasks.md              # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma          # + AdminActionLog model, + AdminActionType enum,
                            #   + 2 back-relations on User

src/modules/admin/          # NEW module
├── search.ts               # searchUsers(query) — case-insensitive email match, cap 20,
│                            #   excludes soft-deleted accounts
├── userDetail.ts            # getUserDetail(userId) — submissions, credit ledger balance,
│                            #   subscription+plan, verification status, audit history
├── credits.ts               # grantCreditAdjustment(adminId, targetUserId, amount, reason)
│                            #   — wraps credits.grantManualCredits + writes AdminActionLog
│                            #   in one transaction
├── revenue.ts                # getRevenueSummary() — MRR, subscriber counts by tier/status,
│                              #   recent payments feed
├── pipeline.ts                # getPipelineHealth() — submission status counts, failure/zero
│                              #   reason breakdown, score distribution buckets
├── growth.ts                   # getGrowthSnapshot() — signup/submission/verification counts
│                               #   for 24h/7d/30d/all-time (supersedes weekly.getAppMetrics)
├── auditLog.ts                  # recordAdminAction(), listActionsForUser(userId)
└── index.ts                     # public exports

src/modules/credits/index.ts     # CHANGED: grantManualCredits() accepts negative integers
                                  #   (deductions), still rejects 0/non-integer
src/modules/weekly/metrics.ts    # CHANGED: getAppMetrics removed (moved into admin/growth.ts);
src/modules/weekly/index.ts      #   export dropped

src/app/(admin)/
├── layout.tsx                    # CHANGED: nav gains "Painel" (/admin) and "Usuários"
│                                  #   (/admin/usuarios) links; drops the old "Métricas" link
├── admin/
│   ├── page.tsx                  # CHANGED: overview dashboard (revenue + pipeline + growth
│   │                              #   cards) instead of a redirect to redacoes-semana
│   ├── metricas/
│   │   └── page.tsx               # CHANGED: redirect to /admin (keeps old bookmarks working)
│   ├── usuarios/
│   │   ├── page.tsx                # NEW: search page (server component + client search box)
│   │   ├── UserSearch.tsx           # NEW: client component — search input, results list
│   │   └── [id]/
│   │       ├── page.tsx              # NEW: user detail (server component)
│   │       └── CreditGrantForm.tsx    # NEW: client component — amount + reason + submit
│   └── redacoes-semana/              # UNCHANGED

src/app/api/admin/
└── usuarios/
    └── [id]/
        └── credits/
            └── route.ts               # NEW: POST — grant/deduct credits (FR-007..010)

tests/unit/admin/
├── search.test.ts
├── userDetail.test.ts
├── credits.test.ts
├── revenue.test.ts
├── pipeline.test.ts
└── growth.test.ts

tests/integration/
└── admin-dashboard.test.ts     # NEW: search → detail → credit-grant → audit-log-visible flow
```

**Structure Decision**: Single Next.js app (existing structure). This feature adds one
module (`src/modules/admin/`), one Prisma model, four page routes under the existing
`(admin)` route group, and one API route — no new project, no new top-level directory.

## Complexity Tracking

*No Constitution Check violations — table not required.*
