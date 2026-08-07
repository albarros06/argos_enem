# Quickstart: Admin Dashboard Overhaul

How to build and verify this feature. Assumes the existing local Postgres setup
(`docker-compose up -d postgres postgres-test`) and an admin-role account — promote one
with the existing `scripts/promote-admin.ts` if needed:

```
npx tsx scripts/promote-admin.ts <email>
```

## Migration

```
npx prisma migrate dev --name admin_action_log
```

Adds `AdminActionType` enum, `AdminActionLog` table, and the two back-relations on `User`.
Additive only — no backfill, no existing table touched.

## Build order (matches tasks.md, once generated)

1. `prisma/schema.prisma` — add the model/enum/relations (data-model.md); run the migration above.
2. `src/modules/credits/index.ts` — widen `grantManualCredits`'s guard to allow negative
   integers (reject only `0`/non-integer), per research.md.
3. `src/modules/admin/auditLog.ts` — `recordAdminAction()`, `listActionsForUser()`.
4. `src/modules/admin/credits.ts` — `grantCreditAdjustment()`, composing
   `credits.grantManualCredits` + `auditLog.recordAdminAction` in one `prisma.$transaction`.
5. `src/modules/admin/search.ts` — `searchUsers(query)`.
6. `src/modules/admin/userDetail.ts` — `getUserDetail(userId)`.
7. `src/modules/admin/revenue.ts` — `getRevenueSummary()`.
8. `src/modules/admin/pipeline.ts` — `getPipelineHealth()`.
9. `src/modules/admin/growth.ts` — `getGrowthSnapshot()` (supersedes `weekly.getAppMetrics`).
10. `src/modules/admin/index.ts` — public exports.
11. Delete `src/modules/weekly/metrics.ts`'s `getAppMetrics` + its export in
    `weekly/index.ts`; delete `src/app/api/admin/metrics/route.ts`.
12. `src/app/api/admin/usuarios/[id]/credits/route.ts` — the one new mutation route
    (contracts/api.md).
13. Pages: `admin/page.tsx` (overview), `admin/usuarios/page.tsx` + `UserSearch.tsx`,
    `admin/usuarios/[id]/page.tsx` + `CreditGrantForm.tsx`, `admin/metricas/page.tsx`
    (→ redirect), `layout.tsx` nav update.
14. `scripts/add-credits.ts` — delete once the dashboard action covers the same case
    (confirm with the user before removing; it's still a valid CLI fallback).

## Local verification

```
pnpm test                 # tests/unit/admin/*.test.ts + updated credits.test.ts
pnpm test -- admin         # just this feature's unit + integration tests
pnpm dev                   # then, as an admin account:
```

Manual pass through the priority order from spec.md:

1. **P1 — search & detail**: `/admin/usuarios`, search a known email, open detail, confirm
   submissions/credits/subscription/verification render (cross-check against a direct
   Prisma/psql query, same as the manual investigations this feature replaces).
2. **P1 — credit grant + audit**: from a user's detail page, grant `+5` with a reason,
   confirm the balance updates and the audit entry appears; then deduct `-2`, confirm the
   same; then try amount `0` and empty reason, confirm both are rejected client- and
   server-side.
3. **P2 — revenue**: `/admin`, confirm MRR and per-tier subscriber counts match a manual
   count of `active` subscriptions × plan price; confirm the recent-payments feed shows the
   latest `PaymentTransaction` rows.
4. **P3 — pipeline**: confirm status counts sum to `Submission.count()`; confirm failure/zero
   -reason breakdowns and score distribution render (including zero-count states if no
   evaluations exist yet in the local DB — seed a few via `pnpm db:seed` if needed).
5. **P4 — growth**: confirm 24h/7d/30d/all-time counts for signups, submissions, and
   verifications look sane against `createdAt` timestamps in the seeded/local data.

## Rollback

The migration is additive (new table + enum + back-relations) — `prisma migrate resolve`
or a straightforward down-migration drops `AdminActionLog` and the enum with no impact on
existing data. Re-adding `weekly.getAppMetrics` and `/admin/metricas`'s original content
from git history is sufficient to revert the page-level change if needed.
