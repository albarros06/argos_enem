# API Contract: Admin Dashboard Overhaul

**Date**: 2026-08-07 | **Plan**: [../plan.md](../plan.md)

Extension to `specs/001-enem-essay-grading/contracts/api.md`. All conventions from the base
contract apply (JSON in/out, `{error:{code,message}}` shape, Zod validation, 400 on
invalid input). Every endpoint below additionally requires the caller to have the `admin`
role (403 `FORBIDDEN` otherwise) — enforced by the existing `requireAdmin()` helper, same
as `/api/admin/weekly-themes` and `/api/admin/metrics` today. No new error codes are needed
— `NOT_FOUND`, `VALIDATION_ERROR`, and `FORBIDDEN` (all pre-existing) cover this feature.

Most of this feature's read data (search results, user detail, revenue, pipeline, growth)
is fetched **server-side directly by the page components** via `src/modules/admin/*`, the
same pattern `admin/metricas/page.tsx` already uses for `getAppMetrics()` — no API route
needed for those reads. The one API route below exists because it's a **mutation**
triggered from a client component (the credit-grant form), matching how
`/api/admin/weekly-themes` backs `AdminThemes.tsx`.

## New Endpoint — Credit Grant (`modules/admin`)

| Method | Path | Purpose | Notes |
|---|---|---|---|
| POST | `/api/admin/usuarios/{id}/credits` | Grant or deduct credits for a user | Body: `{amount: number, reason: string}`. `amount` is a non-zero integer (positive = grant, negative = deduction); `reason` is a non-empty string (max 500 chars). 404 `NOT_FOUND` if `{id}` doesn't match a user. 400 `VALIDATION_ERROR` if `amount` is `0`, non-integer, or `reason` is empty. On success: applies the adjustment via the existing non-expiring `manual_grant` credit kind, writes one `AdminActionLog` row (`action: "credit_grant"`, `adminId` = caller, `targetUserId` = `{id}`, `amount`, `reason`), and returns the user's updated balance. 200 |

### Request body

```json
{ "amount": 5, "reason": "Reembolso — cobrança duplicada (ticket #142)" }
```

### Response body

```json
{
  "balance": { "freeRemaining": 1, "quotaRemaining": 0, "cycleEndsAt": null },
  "auditEntry": {
    "id": "uuid",
    "amount": 5,
    "reason": "Reembolso — cobrança duplicada (ticket #142)",
    "adminEmail": "admin@argos.com",
    "createdAt": "2026-08-07T18:20:00.000Z"
  }
}
```

## Removed Endpoint

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/metrics` | Removed. Superseded by the server-side `getGrowthSnapshot()` / `getRevenueSummary()` / `getPipelineHealth()` calls in `admin/page.tsx`. `/admin/metricas` (the page) becomes a redirect to `/admin` rather than a 404, but the API route itself is deleted along with `weekly.getAppMetrics`. |

## Page data (server-side reads, no new API routes)

Documented here for completeness since they're part of this feature's contract with the
UI, even though they're plain server-component calls rather than HTTP endpoints.

| Page | Module call | Notes |
|---|---|---|
| `/admin` | `getRevenueSummary()`, `getPipelineHealth()`, `getGrowthSnapshot()` | Overview cards (FR-012..018). |
| `/admin/usuarios?q=` | `searchUsers(query)` | Empty `q` shows an empty search state, not all users (spec edge case: no unbounded listing). |
| `/admin/usuarios/{id}` | `getUserDetail(id)` | 404 page (via `notFound()`) if `id` doesn't match a user or matches a soft-deleted one. |
