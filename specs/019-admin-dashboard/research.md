# Phase 0 Research: Admin Dashboard Overhaul

No unresolved `NEEDS CLARIFICATION` markers came out of Technical Context — this feature
reuses the existing stack end to end. The decisions below are the ones with more than one
reasonable option, resolved against this repo's existing conventions.

## Decision: New `src/modules/admin/` module, not an extension of `weekly` or `dashboard`

**Rationale**: `getAppMetrics` currently lives in `src/modules/weekly/metrics.ts` — a
pre-existing modularity violation (app-wide totals inside the weekly-theme module, likely
because it was the first admin page built). `src/modules/dashboard/` is the *student-facing*
personal dashboard (`getDashboard(userId)`, score trends for one user) — a different
consumer and access level entirely; reusing it would mix admin-only aggregate queries with
per-student queries in one module. A dedicated `admin` module gives every admin-only
concern (search, user detail, revenue, pipeline, growth, audit log, credit-grant action) one
home with a single public surface, matching how `groups` and `weekly` are each self-contained.

**Alternatives considered**:
- Extend `weekly/metrics.ts` in place — rejected, deepens the existing boundary violation.
- Put admin reads directly in `page.tsx` server components with no module layer — rejected,
  the same aggregate queries (e.g., submission status counts) are needed by both the
  overview page and tests; a module makes them independently testable per the constitution's
  testing requirement.

## Decision: Retire `weekly.getAppMetrics`, fold into `admin/growth.ts` + `admin/pipeline.ts`

**Rationale**: `getAppMetrics` today returns `totalUsers`, `totalSubmissions`, and
`usersByPlan` — a strict subset of what `admin/growth.ts` (signup/submission counts) and
`admin/revenue.ts` (subscriber-by-tier counts) now provide. Keeping both would mean two
sources of truth for the same numbers. `/admin/metricas` becomes a redirect to `/admin` so
any bookmarked link still resolves.

**Alternatives considered**:
- Leave `getAppMetrics` and the old page alone, additive-only overhaul — rejected; the spec
  explicitly frames this as replacing the bare metrics page, and leaving a second,
  slightly-different totals page would confuse admins about which number is current.

## Decision: `grantManualCredits` gains support for negative amounts (deductions)

**Rationale**: FR-007 requires the dashboard to support both grants and deductions from one
action. The existing function (`src/modules/credits/index.ts`) rejects `amount <= 0`
because its only caller today (`scripts/add-credits.ts`) only grants. Widening the guard to
`amount === 0 || !Number.isInteger(amount)` keeps the existing behavior for positive grants,
adds deductions, and still rejects the no-op/invalid cases (spec edge case: a zero-amount
grant must be rejected the same as a missing amount).

**Alternatives considered**:
- Add a separate `deductManualCredits` function — rejected, it would duplicate the ledger
  insert logic in `grantManualCredits` for no behavioral difference (same `kind: manual_grant`,
  same non-expiring `MANUAL_CYCLE_ID`, only the sign differs).

## Decision: `AdminActionLog` uses a nullable `targetUserId` with `onDelete: SetNull`

**Rationale**: Mirrors the existing LGPD-driven pattern on `PaymentTransaction.userId`
(nullable + `SetNull`, documented in `schema.prisma` as "anonimizado (retenção fiscal) quando
a conta é apagada"). Audit entries are operational/financial records that should outlive the
target account if it's ever deleted/anonymized; a hard FK would either block deletion or
cascade-delete the audit trail we're building this feature specifically to preserve.
`adminId` stays a required, non-nullable FK — admin accounts are not expected to be deleted
through normal product flows, so no anonymization path is needed for it.

**Alternatives considered**:
- Required FK on both sides — rejected, would make user deletion fail or silently destroy
  the audit trail, defeating FR-010.
- Store a denormalized email snapshot instead of a FK — rejected as speculative; no user
  deletion flow exists yet in this codebase to design around, and the simpler FK+SetNull
  matches the one precedent that does exist.

## Decision: Search matches email via case-insensitive `contains`, capped at 20 results

**Rationale**: FR-001/FR-002 and the spec's edge cases call for partial, case-insensitive
matching with a result cap. Prisma's `{ email: { contains: query, mode: "insensitive" } }`
against the existing `@unique` index on `User.email` is sufficient at this app's scale
(admin-only, low query volume) — no need for a search index/extension.

**Alternatives considered**:
- Postgres full-text search / trigram index — rejected as premature; `email` is a single
  short field and current data volume doesn't warrant it (YAGNI, Principle II).

## Decision: Score distribution bucketed in ranges of 100 (0–99 … 900–1000)

**Rationale**: ENEM total scores range 0–1000 in multiples of 40 (5 competencies × 0–200
step 40). Ten buckets of 100 give a readable histogram without over-fragmenting into 26
possible exact totals. This is a display-only computation (`Math.floor(totalScore / 100)`),
no new stored field.

**Alternatives considered**:
- Bucket by exact possible total (26 buckets) — rejected, too granular for an at-a-glance
  dashboard section (FR-017 asks for "distribution," not exact counts).

## Decision: MRR = Σ(`SubscriptionPlan.priceCents`) over `Subscription.status = 'active'`

**Rationale**: Directly satisfies FR-012's definition and the spec's Assumptions section
(no proration/discount modeling). One `groupBy`/join query, no new stored aggregate.

**Alternatives considered**: None — the spec already pins this exact definition; no
reasonable alternative interpretation remains.

## Decision: Credit-grant UI is a client component posting to one new API route

**Rationale**: Matches the existing `AdminThemes.tsx` pattern (client component + `fetch` to
`/api/admin/**`, `router.refresh()` on success) rather than introducing React Server Actions,
which aren't used anywhere else in this codebase yet (Principle II — don't introduce a new
pattern where an existing one already covers the need).

**Alternatives considered**:
- Next.js Server Actions — rejected, would be the first use in the codebase for a
  single-button form; no concrete benefit over the established `fetch`-to-API-route pattern.
