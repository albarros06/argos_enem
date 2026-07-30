# Contract: Feedback Call (Call 2)

Internal contract between `GradingProvider.generateFeedback()` and the model. Not an HTTP
API. Runs only after call 1 succeeds (skipped by the in-code insufficient-text short-circuit,
which supplies its own zero feedback).

## Request

- **Model**: `gemini-2.5-flash-lite` (config: `business.feedbackModelId`).
- **Runtime config**: thinking OFF; `temperature = 0`; structured JSON output
  (`responseMimeType: application/json` + the JSON schema below).
- **Inputs**: `theme`, `essayText`, the five **fixed** scores, and `annulled` (from
  `ScoringResult`). Call 1's reasoning trace is **not** passed.
- **Prompt intent** (`feedbackPrompt.ts`): "The five ENEM competency scores below are already
  final — do not change them. Explain each, write general feedback, and mark specific
  excerpts. If the essay is annulled, classify the reason." Scores + annulled flag are
  rendered into the message.

## Response JSON schema

```jsonc
{
  "type": "object",
  "properties": {
    "zeroReason": {
      "type": "string",
      "enum": ["none", "insufficient_text", "genre_disregard", "theme_disconnection"],
      "description": "When annulled, the specific reason; otherwise \"none\"."
    },
    "justifications": {
      "type": "object",
      "properties": {
        "1": { "type": "string" }, "2": { "type": "string" }, "3": { "type": "string" },
        "4": { "type": "string" }, "5": { "type": "string" }
      },
      "required": ["1", "2", "3", "4", "5"]
    },
    "generalFeedback": { "type": "string" },
    "annotations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "competency": { "type": "integer", "enum": [1, 2, 3, 4, 5] },
          "excerpt": { "type": "string" },
          "issue": { "type": "string" },
          "suggestion": { "type": "string" }
        },
        "required": ["competency", "excerpt", "issue", "suggestion"],
        "propertyOrdering": ["competency", "excerpt", "issue", "suggestion"]
      }
    }
  },
  "required": ["zeroReason", "justifications", "generalFeedback", "annotations"],
  "propertyOrdering": ["zeroReason", "justifications", "generalFeedback", "annotations"]
}
```

- The `"none"` sentinel remaps to `null` before Zod validation (mirrors the existing
  `parseGeminiEvaluation` `none → null` convention).
- Validated by a feedback-only Zod schema (today's `llmEvaluationSchema` with the `score`
  fields removed).

## `zeroReason` classification rules

- `annulled === false` → `zeroReason` MUST be `null` (model returns `"none"`).
- `annulled === true` → `zeroReason` MUST be one of the three reasons. Call 2 classifies from
  the essay; it does **not** override the annulled decision (that is call 1's).
- Excerpts are anchored by the existing `anchorAnnotations`.

## Degraded fallback (call 2 fails after retries)

Return a synthetic `FeedbackResult`:
- `justifications`: a placeholder sentence per competency (e.g. "Justificativa detalhada
  indisponível para esta correção.").
- `generalFeedback`: a non-empty placeholder sentence.
- `annotations`: empty.
- `zeroReason`: `theme_disconnection` iff `annulled` (documented degraded default — the most
  frequent structural annulment; `insufficient_text` is already handled pre-call-2), else
  `null`.

The evaluation is still persisted with the **real scores** and marked completed; no refund.

## Test vectors

- Non-annulled essay → five justifications, non-empty `generalFeedback`, `zeroReason=null`,
  annotations anchored.
- Annulled essay → all inputs scores 0, `zeroReason` ∈ three reasons, feedback explains it.
- `"none"` sentinel → remaps to `null`.
- Call fails ×retries → degraded fallback persisted with real scores, no refund, submission
  completed.
