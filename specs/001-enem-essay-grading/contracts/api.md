# API Contract: Argos — ENEM Essay Grading Platform

**Date**: 2026-06-10 | **Plan**: [../plan.md](../plan.md)

All endpoints are Next.js route handlers under `/api`. JSON in/out; errors follow
`{ "error": { "code": string, "message": string } }` with appropriate HTTP status.
All endpoints except auth and the Asaas webhook require an authenticated session;
every resource access is scoped to the session user (FR-003). Validation via Zod;
invalid input → 400 with field-level details.

## Auth (`modules/auth`)

| Method | Path | Purpose | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | Create account | body `{name, email, password}`; sends verification email (FR-001); 201 |
| POST | `/api/auth/verify-email` | Confirm email | body `{token}`; 200 or 410 expired |
| POST | `/api/auth/resend-verification` | Re-send token | rate-limited |
| POST | `/api/auth/[...nextauth]` | Login/logout/session | Auth.js standard (FR-002) |
| POST | `/api/auth/forgot-password` | Request reset | always 200 (no account enumeration) |
| POST | `/api/auth/reset-password` | Apply reset | body `{token, newPassword}` |
| DELETE | `/api/account` | LGPD account deletion | FR-028; 202 (async job) |

## Submissions (`modules/submissions`, `transcription`, `grading`)

| Method | Path | Purpose | Notes |
|---|---|---|---|
| POST | `/api/submissions` | Start submission | body `{themeId? , themeText, imageSha256, contentType, sizeBytes}`. Guards: email verified, credit/quota available (402 `PAYWALL` otherwise — FR-021), size/format limits (FR-004), duplicate `imageSha256` warning (409 `DUPLICATE_IMAGE`, overridable with `force:true`). Returns `{submissionId, uploadUrl}` (R2 presigned). 201 |
| POST | `/api/submissions/{id}/uploaded` | Client signals upload done | triggers OCR; status → `pending`→`awaiting_review` or `failed` (no credit consumed — FR-007) |
| GET | `/api/submissions/{id}` | Status + current data | `{status, failureReason?, transcription?: {rawText, meanConfidence}, evaluation?: EvaluationView}` — the polling endpoint (R6) |
| POST | `/api/submissions/{id}/confirm` | Confirm transcription | body `{confirmedText}` (must be non-trivially derived from rawText — server sanity-checks length). **Consumes credit atomically**, deletes image, starts grading (clarification 1, FR-008). 409 if not `awaiting_review` |
| DELETE | `/api/submissions/{id}` | Abandon before confirm | deletes image; status → `expired`; no credit consumed |
| GET | `/api/submissions` | List own submissions | paginated; `{id, themeText, status, totalScore?, createdAt}` (FR-018) |

### EvaluationView (returned inside GET submission when `completed`)

```json
{
  "totalScore": 720,
  "competencies": [ {"competency": 1, "score": 160}, ... ],
  "zeroReason": null,
  "generalFeedback": "…",
  "confirmedText": "…",
  "annotations": [
    {
      "competency": 1,
      "excerpt": "menas pessoas",
      "startOffset": 312, "endOffset": 326, "anchored": true,
      "issue": "Concordância: 'menas' não existe em norma culta.",
      "suggestion": "Use 'menos pessoas'."
    }
  ]
}
```

## Dashboard (`modules/dashboard`)

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/api/dashboard` | Aggregated progress | `{scoreSeries: [{date, totalScore, submissionId}], competencies: [{competency, latest, average, trend}], submissionCount}` (FR-016/017); empty-state when no evaluations (US2) |

## Credits & Billing (`modules/credits`, `billing`)

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/api/credits` | Balance | `{freeRemaining, quotaRemaining, cycleEndsAt?}` (FR-020) |
| GET | `/api/billing/plans` | Active plans | `[{id, tier, name, priceCents, monthlyQuota}]` (paywall content — FR-021/022) |
| POST | `/api/billing/subscribe` | Start subscription | body `{planId, method: "card"|"pix", card?: {…tokenized}}`; creates Asaas customer+subscription; returns `{status, pixQrCode?}`; entitlements only on webhook confirmation (FR-024) |
| POST | `/api/billing/upgrade` | Entry → premium | prorated one-off charge (R4, FR-025/026); 409 if already premium |
| POST | `/api/billing/cancel` | Cancel at period end | sets `cancelAtPeriodEnd` (FR-025) |
| GET | `/api/billing/subscription` | Current subscription | `{tier, status, currentPeriodEnd, cancelAtPeriodEnd}` |

## Webhooks

| Method | Path | Purpose | Notes |
|---|---|---|---|
| POST | `/api/webhooks/asaas` | Asaas events | validates access token header; idempotent via `WebhookEvent.id` (R4). Handles: payment confirmed → activate/renew + `quota_grant`; overdue → `past_due` grace; subscription deleted → revert at period end. Always 200 on duplicates |

## Cross-cutting error codes

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | no/invalid session |
| `EMAIL_NOT_VERIFIED` | 403 | FR-001 gate |
| `PAYWALL` | 402 | no credits/quota — body includes plans (FR-021) |
| `DUPLICATE_IMAGE` | 409 | same photo uploaded twice (edge case) |
| `INVALID_STATE` | 409 | action not allowed in current submission status |
| `EXTRACTION_FAILED` | — | surfaced via submission `failureReason`, not HTTP error |
| `VALIDATION_ERROR` | 400 | Zod failure, field details included |
