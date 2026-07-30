# Phase 1 Data Model: Two-Call Calibrated Grading Pipeline

No database schema change. The persisted entities (`Evaluation`, `Annotation`, the
`ZeroReason` enum) keep their current Prisma definitions. The two-call split introduces
**in-memory** intermediate types only; they are merged into the existing records before
persistence.

## Persisted entities (existing — unchanged)

### Evaluation

| Field | Type | Notes for this feature |
|-------|------|------------------------|
| `scoreC1..C5` | Int | Populated from **call 1** (scoring), values in {0,40,80,120,160,200}. |
| `totalScore` | Int | Sum of the five scores. |
| `justifications` | Json | `{ "1": string, …, "5": string }` from **call 2**; on degraded feedback, a fallback sentence per competency. |
| `generalFeedback` | String (non-null) | From **call 2**; degraded fallback is a real sentence, never empty. |
| `zeroReason` | `ZeroReason?` | Owned by **call 2** classification (annulled) or the in-code short-circuit; null when not annulled. |
| `rubricVersion` | String | Bumped to **"2.0.0"**. |
| `modelId` | String | Records **both** models, e.g. `"score:gemini-2.5-flash+fb:gemini-2.5-flash-lite"`. |
| `createdAt` | DateTime | Unchanged. |

Invariants (unchanged, still enforced post-parse): exactly five competencies (1–5);
`zeroReason` non-null ⇒ all five scores are 0.

### Annotation (unchanged)

`competency`, `excerpt`, `startOffset?`, `endOffset?`, `anchored`, `issue`, `suggestion` —
produced by **call 2**, then run through the existing `anchorAnnotations` step. Unfound
excerpts stay `anchored=false` with null offsets.

### ZeroReason enum (unchanged)

`insufficient_text` · `genre_disregard` · `theme_disconnection`.

## Intermediate types (new — in-memory only, not persisted)

### ScoringResult (output of call 1)

| Field | Type | Rules |
|-------|------|-------|
| `annulled` | boolean | Parsed from `ANNULLED: <yes\|no>`. |
| `scores` | `Record<1..5, Score>` | Each ∈ {0,40,80,120,160,200}; all 0 when `annulled`. |

Parse failure (missing/invalid block) → throw → call-1 failure path (fail + refund).

### FeedbackResult (output of call 2)

| Field | Type | Rules |
|-------|------|-------|
| `zeroReason` | `ZeroReason \| null` | One of three when `annulled`; null otherwise. Call 2 does **not** flip the annulled decision. |
| `justifications` | `{ [1..5]: string }` | One per competency. |
| `generalFeedback` | string | Non-empty. |
| `annotations` | `Array<{competency, excerpt, issue, suggestion}>` | ≥3 when quality permits (existing SC-005 warning retained); empty allowed only for annulled essays. |

Validated by a **feedback-only** Zod schema (a trim of today's `llmEvaluationSchema` with
scores removed and `zeroReason` retained).

### Merge rule (assembly in `evaluateSubmission`)

```
Evaluation = ScoringResult.scores
           ⊕ FeedbackResult.{justifications, generalFeedback, annotations, zeroReason}
           ⊕ { rubricVersion: 2.0.0, modelId: score+fb }
```

Degraded path (call 2 failed after retries): `FeedbackResult` is replaced by a fallback —
placeholder `justifications`/`generalFeedback`, empty `annotations`, and `zeroReason` =
`theme_disconnection` iff `ScoringResult.annulled` (documented degraded default), else null.

## State transitions (unchanged submission lifecycle)

```
grading ──(call1 ok)──▶ [score] ──(call2 ok)─────▶ completed
   │                        └────(call2 fail×retries)──▶ completed (degraded feedback)
   └──(call1 fail | parse fail | <min lines never reaches here)──▶ failed (refund + weekly entry removed)

grading ──(< min lines)──▶ completed (insufficient_text zero, no model call)
```
