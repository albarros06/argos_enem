# Data Model: Argos — ENEM Essay Grading Platform

**Date**: 2026-06-10 | **Plan**: [plan.md](./plan.md)

All persistent data in PostgreSQL via Prisma. Names below are the Prisma model names;
columns use camelCase. Monetary values stored in integer cents (BRL).

## Entity Relationship Overview

```text
User 1──* Submission 1──1 Transcription
                      1──1 Evaluation 1──* Annotation
User 1──* CreditTransaction
User 1──1 Subscription *──1 SubscriptionPlan
Subscription 1──* PaymentTransaction
User 1──* PaymentTransaction
EssayTheme 1──* Submission   (optional FK; free-form theme stored on Submission)
```

## Models

### User

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | string unique | login identifier |
| passwordHash | string | bcrypt |
| name | string | |
| emailVerifiedAt | datetime? | null until verified; submission blocked while null (FR-001) |
| asaasCustomerId | string? | created lazily at first checkout (R4) |
| createdAt / updatedAt | datetime | |
| deletedAt | datetime? | soft-delete marker during LGPD erasure job (FR-028) |

**Validation**: email RFC format; password ≥ 8 chars (Zod, shared client/server).

### Submission

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| userId | FK → User | owner; all queries scoped by it (FR-003) |
| themeId | FK → EssayTheme? | when picked from catalog |
| themeText | string | denormalized theme statement (required — FR-005) |
| status | enum | see state machine below |
| imageKey | string? | R2 object key; **null after image deletion** (FR-027a) |
| imageSha256 | string | duplicate-upload warning (edge case) |
| failureReason | enum? | `extraction_failed` \| `insufficient_text` \| `grading_failed` |
| createdAt / updatedAt | datetime | |

**State machine** (single source of truth in `modules/submissions`):

```text
pending ──extract ok──▶ awaiting_review ──confirm──▶ grading ──ok──▶ completed
   │                         │                          │
   │ extract fail/low conf   │ abandoned >24h (sweep)   │ LLM/validation fail
   ▼                         ▼                          ▼
 failed                   expired                    failed (credit refunded, FR-015)
```

Credit is consumed exactly at the `awaiting_review → grading` transition (confirm,
clarification 1) and refunded on `grading → failed` (FR-015). Image is deleted on
leaving `awaiting_review` in any direction and on `pending → failed` (FR-027a).

### Transcription

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| submissionId | FK → Submission unique | 1:1 |
| rawText | string | original OCR output (retained — FR-008) |
| confirmedText | string? | student-corrected text; set at confirmation; grading input |
| meanConfidence | float | from Vision per-word confidence (R2) |
| confirmedAt | datetime? | |

### Evaluation

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| submissionId | FK → Submission unique | 1:1 |
| scoreC1..scoreC5 | int | each ∈ {0,40,80,120,160,200} (DB check constraint) |
| totalScore | int | = sum(C1..C5); stored for dashboard query simplicity |
| generalFeedback | string | FR-012 |
| zeroReason | enum? | `insufficient_text` \| `genre_disregard` \| `theme_disconnection` (FR-013) |
| rubricVersion | string | R9 |
| modelId | string | e.g. `claude-sonnet-4-6`; audit/cost trail |
| createdAt | datetime | |

### Annotation

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| evaluationId | FK → Evaluation | |
| competency | int 1–5 | FR-011 |
| excerpt | string | verbatim substring of confirmedText |
| startOffset / endOffset | int? | computed server-side (R8); null when `anchored=false` |
| anchored | boolean | excerpt located successfully |
| issue | string | what is wrong |
| suggestion | string | suggested correction |

### CreditTransaction (ledger)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| userId | FK → User | |
| amount | int | +grant / −consume; balance = SUM(amount) |
| kind | enum | `signup_grant` \| `quota_grant` \| `consume` \| `refund` \| `quota_expiry` |
| submissionId | FK → Submission? | set on consume/refund |
| cycleId | string? | groups quota_grant with its offsetting quota_expiry (no-rollover, clarification 3) |
| createdAt | datetime | |

**Rules**: append-only ledger (auditability beats a mutable counter). Signup grants
3 credits (`signup_grant`, FR-019 — value from config). Monthly quota: on cycle
payment confirmation insert `quota_grant` of the plan's quota; at cycle end insert
`quota_expiry` of −(unused quota credits) so unused quota nets to zero (FR-022).
`signup_grant` credits never expire. Consumption order: quota credits first, then
free credits. Balance check + consume happen in one DB transaction (concurrency-safe).

### SubscriptionPlan (seed data)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tier | enum | `entry` \| `premium` (FR-022) |
| name | string | display name |
| priceCents | int | BRL; **seed data, not code** (R11) |
| monthlyQuota | int | corrections per cycle; seed data |
| active | boolean | allows price changes by inserting a new row |

### Subscription

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| userId | FK → User unique | one active subscription per user |
| planId | FK → SubscriptionPlan | |
| asaasSubscriptionId | string | |
| status | enum | `active` \| `past_due` (grace period) \| `canceled` (access until period end) \| `expired` |
| currentPeriodStart / currentPeriodEnd | datetime | quota cycle boundaries |
| cancelAtPeriodEnd | boolean | FR-025 cancel semantics |
| createdAt / updatedAt | datetime | |

**Transitions** (driven by Asaas webhooks, idempotent — R4):
payment confirmed → `active` + new quota cycle; payment overdue → `past_due` (grace,
notified in-app); grace expired → `expired` (revert to free state); user cancel →
`cancelAtPeriodEnd=true`, then `canceled`/`expired` at period end. Upgrade: prorated
one-off charge confirmed → planId switches, quota difference granted immediately (R4).

### PaymentTransaction

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| userId | FK → User | |
| subscriptionId | FK → Subscription? | |
| asaasPaymentId | string unique | idempotency key for webhooks |
| kind | enum | `cycle` \| `upgrade_proration` |
| amountCents | int | |
| method | enum | `card` \| `pix` |
| status | enum | `pending` \| `confirmed` \| `failed` \| `refunded` |
| createdAt / updatedAt | datetime | |

### EssayTheme (catalog, optional convenience)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| title | string | e.g. past ENEM themes |
| year | int? | |
| active | boolean | |

### WebhookEvent

| Field | Type | Notes |
|---|---|---|
| id | string PK | Asaas event id — uniqueness enforces idempotency (R4) |
| payload | jsonb | raw event for audit/replay |
| processedAt | datetime | |

## Derived views (no extra tables)

- **Dashboard** (FR-016..018): queries over `Evaluation` joined to `Submission`
  scoped by user — total-score series by `createdAt`, per-competency latest/avg/trend.
  Plain indexed queries; no materialized views at v1 scale (Constitution II).
- **Credit balance** (FR-020): `SUM(amount)` over `CreditTransaction` per user,
  split by expiring/non-expiring kinds for display.

## LGPD account deletion (FR-028)

Deletion job: revoke sessions → cancel Asaas subscription → delete any remaining R2
objects → delete Annotations/Evaluations/Transcriptions/Submissions/CreditTransactions →
anonymize PaymentTransactions (fiscal retention) → delete User row. Soft-delete marker
(`deletedAt`) only exists during job execution.
