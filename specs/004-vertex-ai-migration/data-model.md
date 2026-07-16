# Phase 1 Data Model: Migrate Gemini Grading Provider to Vertex AI

**Feature**: `004-vertex-ai-migration` | **Date**: 2026-07-16

This feature introduces **no database entities and no schema migrations**. The "data" here is
configuration and the in-memory grading contract, both of which are preserved. This document
records the configuration model and confirms the unchanged runtime contract.

## Configuration entities

### Grading configuration (environment)

| Key | Type | Default | Required | Notes |
|-----|------|---------|----------|-------|
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | string (JSON) | `""` | Yes, in production | Existing secret, reused. Parsed to an object; `project_id` used as the default Vertex project. Must be a `service_account` with `roles/aiplatform.user`. |
| `GOOGLE_CLOUD_LOCATION` | string | `us-central1` | No | Vertex AI region for grading (FR-011). |
| `GOOGLE_CLOUD_PROJECT` | string | `""` → derived from credential `project_id` | No | Override only when the credential's project differs from the Vertex project (R2). |
| `GRADING_MODEL_ID` | string | `gemini-2.5-pro` | No | Unchanged. Prefix selects provider: `gemini-*` → Vertex, `claude-*` → Anthropic. |
| `FAKE_VENDORS` | string | `""` | No | Unchanged. `"1"` selects the deterministic fake provider. |

**Removed**: `GEMINI_API_KEY` (FR-009) — deleted from the env schema and `.env.example`.

**Validation rules** (in `src/lib/config.ts` / env-config tests):
- When `GOOGLE_APPLICATION_CREDENTIALS_JSON` is set, it MUST parse as JSON and contain
  `type: "service_account"`, `project_id`, `private_key` (PEM), and `client_email`
  (already enforced by `tests/unit/env-config.test.ts`).
- `GOOGLE_CLOUD_LOCATION` defaults to `us-central1` when unset.
- Effective project = `GOOGLE_CLOUD_PROJECT` if non-empty, else credential `project_id`.

### Provider selection (unchanged logic)

State selection performed by `gradingProvider()` in `src/modules/grading/llm.ts`:

```text
FAKE_VENDORS == "1"                → FakeGradingProvider
else GRADING_MODEL_ID startsWith "gemini" → GeminiGradingProvider (now Vertex-backed)
else                               → AnthropicGradingProvider
```

Only the internals of `GeminiGradingProvider` change (client construction). The branch
structure is preserved.

## Runtime contract (unchanged — must be preserved)

### `GradingProvider` interface

```text
grade(input: { theme: string; essayText: string }) → Promise<LlmEvaluation>
```

### `LlmEvaluation` (from `src/modules/grading/schema.ts`, validated by Zod)

| Field | Shape | Constraint |
|-------|-------|-----------|
| `zeroReason` | `null \| "insufficient_text" \| "genre_disregard" \| "theme_disconnection"` | Model emits sentinel `"none"`; provider remaps to `null` before Zod parse. |
| `competencies` | array of exactly 5 | Each: `competency ∈ {1..5}`, `score ∈ {0,40,80,120,160,200}`, `justification: string`. |
| `generalFeedback` | string | — |
| `annotations` | array | Each: `competency ∈ {1..5}`, `excerpt`, `issue`, `suggestion`. |

The persisted `Evaluation.modelId` continues to be `business.gradingModelId`. No column,
index, or relation changes.

## Non-goals (explicitly unchanged)

- Rubric text and `RUBRIC_VERSION`.
- Scoring scale, competency schema, annotation anchoring.
- Anthropic provider and fake provider behavior.
- Database schema, Prisma models, and the grading pipeline in `src/modules/grading/index.ts`.
