# Quickstart: Two-Call Calibrated Grading Pipeline

How to build, configure, and validate this feature. Assumes the existing Vertex AI
service-account credentials in `.env` (shared with OCR grading).

## Prerequisites

- The tuned prompt: `/home/enceladdus/projects/enem_db/fine_tuning/prompts/v5_calibrated.md`
  (copied **verbatim** into `src/modules/grading/scoringPrompt.ts`).
- Vertex AI access to `gemini-2.5-flash` (with dynamic thinking) and
  `gemini-2.5-flash-lite` in the configured region.
- Eval-harness assets present for validation: `scripts/eval/data/{validation-300,test-300}.jsonl`,
  `.env` Vertex credentials.

## Configuration (`src/lib/config.ts`)

```
GRADING_MODEL_ID          → scoring model (default gemini-2.5-flash)      # call 1
FEEDBACK_MODEL_ID         → feedback model (default gemini-2.5-flash-lite) # call 2 (new)
GRADING_MAX_OUTPUT_TOKENS → 32768 (raised from 8192; needed for thinking) # call 1
FEEDBACK_MAX_OUTPUT_TOKENS→ modest (e.g. 2048) (new)                       # call 2
MIN_ESSAY_LINES           → 7 (unchanged; in-code zero short-circuit)
```

Scoring call also sets, in code (not env): `thinking_budget = -1`, `temperature = 0`.

## Build order (matches tasks.md, once generated)

1. `scoringPrompt.ts` — v5 verbatim + `{{THEME}}`/`{{ESSAY}}` builder.
2. `scoreParser.ts` — parse/validate the `ANNULLED + C1..C5` block (contract: scoring-call.md).
3. `schema.ts` — feedback-only Zod schema + retained consistency checks.
4. `feedbackPrompt.ts` — call-2 prompt (contract: feedback-call.md).
5. `llm.ts` — split provider into `scoreEssay()` + `generateFeedback()` for Gemini,
   Anthropic, and Fake; split the fake queue accordingly.
6. `index.ts` — orchestrate call 1 → call 2 → merge/persist; degraded-feedback fallback;
   bump `RUBRIC_VERSION` to `2.0.0`; write combined `modelId`.
7. `config.ts` — add feedback model + token settings.

## Local verification (fakes, no external calls)

```
pnpm vitest run tests/unit/grading-schema.test.ts \
                tests/unit/grading-provider.test.ts \
                tests/unit/anchoring.test.ts \
                tests/unit/score-parser.test.ts        # new
pnpm vitest run tests/integration/submissions.test.ts  # split fakes, end-to-end flow
```

Manual smoke (fake provider): submit an essay via the app, confirm the results page shows
five scores, five justifications, general feedback, and highlighted annotations — i.e. no
visual change from today.

## Quality validation (SC-001, real model)

Reproduce the tuned QWK on this app's runtime before launch, using a v5 variant with the new
parser:

```
CONCURRENCY=3 npx tsx scripts/eval/run-variant.ts v5-scoring scripts/eval/data/validation-300.jsonl
python3 scripts/eval/report.py  scripts/eval/results/validation-300--gemini-2.5-flash--v5-scoring.jsonl \
        --md scripts/eval/results/report-validation-v5.md
python3 scripts/eval/compare.py scripts/eval/results/validation-300--gemini-2.5-flash--baseline.jsonl \
        scripts/eval/results/validation-300--gemini-2.5-flash--v5-scoring.jsonl
```

Ship gate (SC-001): v5-scoring reproduces global QWK ≈ 0.54 **and** beats the production
`baseline` with `compare.py` paired-bootstrap confidence. Only the scoring call is measured
(scores are what QWK needs); the feedback call is not part of the QWK number.

## Rollback

`RUBRIC_VERSION` distinguishes eras. To revert, restore the single-call path in `llm.ts`
/`index.ts` (legacy `rubric.ts` prompt is retained). No DB migration to undo — the persisted
shape never changed.

## Monitoring (post-launch)

- Spot-check a small % of production gradings against human scores; alert if rolling QWK
  drifts below a threshold (triggers re-validation).
- Track call-2 degraded-fallback rate (feedback failures) — a rising rate signals a
  flash-lite/availability problem without affecting scores.
- Watch grading-task duration for two-call latency regressions (SC-005).
