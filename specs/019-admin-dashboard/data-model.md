# Phase 1 Data Model: Admin Dashboard Overhaul

One new Prisma model and two small back-relations on `User`. Every other entity used by
this feature (`User`, `Submission`, `Evaluation`, `CreditTransaction`, `Subscription`,
`SubscriptionPlan`, `PaymentTransaction`) is read-only from this feature's perspective and
keeps its current definition — see `prisma/schema.prisma`.

## New: `AdminActionType` (enum)

```prisma
enum AdminActionType {
  credit_grant
}
```

Single value today (FR-010 scopes v1 to credit-grant actions only). Future admin actions
(resend verification, cancel subscription, etc. — out of scope per spec Assumptions) extend
this enum without a schema shape change.

## New: `AdminActionLog`

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `adminId` | `String` | FK → `User.id`. Required — admin accounts aren't deleted through any existing flow. |
| `action` | `AdminActionType` | `credit_grant` for v1. |
| `targetUserId` | `String?` | FK → `User.id`, `onDelete: SetNull`. Nullable so the audit trail survives if the target account is ever deleted/anonymized (mirrors `PaymentTransaction.userId`'s existing LGPD pattern). |
| `amount` | `Int?` | Signed credit delta for `credit_grant` (positive = grant, negative = deduction). Null for future action types that don't carry an amount. |
| `reason` | `String?` | Free-text reason supplied by the admin. Required at the application layer for `credit_grant` (FR-008) even though nullable at the schema layer, to keep the column reusable for action types that may not need one. |
| `createdAt` | `DateTime @default(now())` | |

```prisma
model AdminActionLog {
  id           String           @id @default(uuid())
  adminId      String
  action       AdminActionType
  targetUserId String?
  amount       Int?
  reason       String?
  createdAt    DateTime         @default(now())

  admin      User  @relation("AdminActionsPerformed", fields: [adminId], references: [id])
  targetUser User? @relation("AdminActionsReceived", fields: [targetUserId], references: [id], onDelete: SetNull)

  @@index([targetUserId, createdAt])
  @@index([adminId, createdAt])
}
```

### `User` model — additive changes

```prisma
model User {
  // ...existing fields unchanged...

  adminActionsPerformed AdminActionLog[] @relation("AdminActionsPerformed")
  adminActionsReceived  AdminActionLog[] @relation("AdminActionsReceived")
}
```

Both are pure back-relations (no new scalar columns on `User`); this is an additive,
backward-compatible migration — no data backfill needed.

## Read-side shapes (in-memory only, not persisted)

These are the TypeScript return types for the new module's query functions
(`src/modules/admin/*.ts`). None introduce new tables.

### `UserSearchResult` (from `search.ts`)

| Field | Type |
|---|---|
| `id` | `string` |
| `email` | `string` |
| `name` | `string` |
| `emailVerifiedAt` | `Date \| null` |
| `createdAt` | `Date` |

### `UserDetail` (from `userDetail.ts`)

| Field | Type | Source |
|---|---|---|
| `user` | `{ id, email, name, emailVerifiedAt, createdAt, role }` | `User` |
| `submissions` | `{ id, themeText, status, totalScore: number \| null, createdAt }[]` | `Submission` ⋈ `Evaluation` |
| `creditBalance` | `CreditBalance` (existing type from `modules/credits`) | `getBalance(userId)` |
| `creditTransactions` | `{ id, amount, kind, cycleId, createdAt }[]` | `CreditTransaction` |
| `subscription` | `{ tier, planName, status, currentPeriodStart, currentPeriodEnd } \| null` | `Subscription` ⋈ `SubscriptionPlan` |
| `auditHistory` | `{ id, action, amount, reason, adminEmail, createdAt }[]` | `AdminActionLog` where `targetUserId = userId` |

### `RevenueSummary` (from `revenue.ts`)

| Field | Type |
|---|---|
| `mrrCents` | `number` — Σ `plan.priceCents` over `Subscription.status = 'active'` |
| `subscribersByTierAndStatus` | `{ tier: PlanTier, status: SubscriptionStatus, count: number }[]` |
| `recentPayments` | `{ id, amountCents, method, status, userEmail: string \| null, createdAt }[]` (last 20, newest first) |

### `PipelineHealth` (from `pipeline.ts`)

| Field | Type |
|---|---|
| `statusCounts` | `{ status: SubmissionStatus, count: number }[]` (all 7 enum values, 0 included) |
| `failureReasonCounts` | `{ reason: FailureReason, count: number }[]` |
| `zeroReasonCounts` | `{ reason: ZeroReason, count: number }[]` |
| `scoreDistribution` | `{ bucketStart: number, count: number }[]` — 10 buckets, width 100, over `Evaluation.totalScore` where the parent `Submission.status = 'completed'` |

### `GrowthSnapshot` (from `growth.ts`)

| Field | Type |
|---|---|
| `signups` | `{ last24h, last7d, last30d, allTime: number }` — `User.createdAt` |
| `submissions` | `{ last24h, last7d, last30d, allTime: number }` — `Submission.createdAt` |
| `verifications` | `{ last24h, last7d, last30d, allTime: number }` — `User.emailVerifiedAt IS NOT NULL` |

## Validation rules

- `grantCreditAdjustment(adminId, targetUserId, amount, reason)`: `amount` must be a
  non-zero integer (positive or negative); `reason` must be a non-empty trimmed string
  (max length consistent with existing free-text fields, e.g. 500 chars). Both checks map
  to FR-008 and the spec's zero-amount edge case.
- `searchUsers(query)`: `query` must be a non-empty trimmed string; results capped at 20
  (spec edge case), soft-deleted accounts (`deletedAt IS NOT NULL`) excluded.
