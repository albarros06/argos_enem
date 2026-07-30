---

description: "Task list for Two-Call Calibrated Grading Pipeline"
---

# Tasks: Two-Call Calibrated Grading Pipeline

**Input**: Design documents from `/specs/018-two-call-grading/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUDED — the spec explicitly requests them (FR-019 split fakes, FR-020 parser
+ degraded-path coverage) and the constitution mandates tests for new behavior.

**Organization**: Grouped by user story (US1–US4 from spec.md) for independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 / US4 (Setup, Foundational, Polish have no story label)

## Path Conventions

Single Next.js web app. Grading logic in `src/modules/grading/`; config in `src/lib/`;
tests in `tests/unit` and `tests/integration`; eval harness in `scripts/eval/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration knobs and version marker used by all stories.

- [X] T001 [P] Add scoring + feedback config keys to `src/lib/config.ts`: `gradingModelId` default `"gemini-2.5-flash"` (`GRADING_MODEL_ID`), new `feedbackModelId` default `"gemini-2.5-flash-lite"` (`FEEDBACK_MODEL_ID`), `gradingMaxOutputTokens` default `32768` (raised from 8192), new `feedbackMaxOutputTokens` default `2048` (`FEEDBACK_MAX_OUTPUT_TOKENS`).
- [X] T002 [P] Bump `RUBRIC_VERSION` from `"1.0.0"` to `"2.0.0"` in `src/modules/grading/rubric.ts` (update the versioning comment to note the two-call change).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Intermediate types and the additive provider-interface change every story builds on.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T003 Define intermediate types `ScoringResult` (`annulled: boolean`, `scores: Record<1..5, Score>`) and `FeedbackResult` (`zeroReason`, `justifications`, `generalFeedback`, `annotations`) in `src/modules/grading/schema.ts`, per data-model.md.
- [X] T004 Extend the `GradingProvider` interface in `src/modules/grading/llm.ts` **additively**: add `scoreEssay(input): Promise<ScoringResult>` and `generateFeedback(input): Promise<FeedbackResult>` alongside the existing `grade()` (leave `grade()` intact so `index.ts` keeps compiling on the old path until US2 rewires it). Provide throwing stubs for the new methods on all three providers.

**Checkpoint**: Module compiles; existing single-call path still works; new method surface exists.

---

## Phase 3: User Story 1 - Accurate, consistent competency scores (Priority: P1) 🎯 MVP

**Goal**: The scoring call runs `v5_calibrated` verbatim under its validated config and yields the five competency scores + annulled flag.

**Independent Test**: Run the scoring call over `validation-300` through the eval harness and confirm it reproduces global QWK ≈ 0.54 and beats `baseline` via `compare.py` (SC-001) — no DB/UI wiring required for this story.

### Tests for User Story 1

- [X] T005 [P] [US1] Unit tests for the score-block parser (all test vectors in `contracts/scoring-call.md`: well-formed, annulled-forces-zero, last-occurrence-wins, missing line, out-of-set value, truncated/empty) in `tests/unit/score-parser.test.ts`.

### Implementation for User Story 1

- [X] T006 [P] [US1] Copy `enem_db/fine_tuning/prompts/v5_calibrated.md` **verbatim** into `src/modules/grading/scoringPrompt.ts` as `SCORING_PROMPT`. Add `buildScoringMessage(theme, essayText)` and `scoringSystemInstruction()` that replicate the validated `render()` (grader.py:43-54): system = `SCORING_PROMPT` with `{{THEME}}`/`{{ESSAY}}` stripped and trimmed; user = `"THEME (motivating text):\n{theme}\n\nESSAY:\n{essayText}\n"`. Add a unit test asserting the rendered strings match this format byte-for-byte.
- [X] T007 [P] [US1] Implement `src/modules/grading/scoreParser.ts` — parse the trailing `ANNULLED` + `C1..C5` block (case-insensitive, last occurrence), validate each score ∈ {0,40,80,120,160,200}, force all scores to 0 when `ANNULLED: yes`, throw on any missing/invalid/truncated block — per `contracts/scoring-call.md`.
- [X] T008 [US1] Implement `GeminiGradingProvider.scoreEssay()` in `src/modules/grading/llm.ts`: model `business.gradingModelId`, `thinking_budget=-1`, `maxOutputTokens=business.gradingMaxOutputTokens` (32768), `temperature=0`, **no** `responseJsonSchema`; wrap in `logger.vendorCall`/`withRetry`; parse via `scoreParser`; keep the model/region error-context wrapper. (depends T004, T006, T007)
- [X] T009 [US1] Leave `AnthropicGradingProvider.scoreEssay()` as a throwing stub in `src/modules/grading/llm.ts` ("two-call grading is Gemini-only; v5 validated on gemini-2.5-flash"). Rationale: prod selects Gemini (`gradingModelId=gemini-2.5-flash`) and v5's thinking/32768 config is Gemini-specific — building an Anthropic path would be speculative (Constitution II). (depends T004)
- [X] T010 [US1] Split the fake provider for scoring in `src/modules/grading/llm.ts`: add `enqueueFakeScoringResult` + `defaultFakeScoringResult(essayText)` and implement `FakeGradingProvider.scoreEssay()` from the scoring queue. (depends T004)
- [X] T011 [P] [US1] Add SC-001 runner `scripts/eval/run-v5-scoring.ts`. NOTE (implementation deviation): the harness's `gradeVariantJob` hard-codes JSON parsing, so a `variants/` entry can't run v5's text output. Instead the runner drives the REAL production `gradingProvider().scoreEssay()` (same v5 prompt, renderer, thinking config, and `scoreParser` as prod) through `gradeSplit` — higher fidelity for SC-001 and no change to feature-011 harness internals.

**Checkpoint**: Scoring call measurable end-to-end via the harness (SC-001); production path unchanged.

---

## Phase 4: User Story 2 - Rich feedback preserved (Priority: P1)

**Goal**: The feedback call restores per-competency justifications, general feedback, and inline annotations, and the two calls are wired into the persisted `Evaluation`/`Annotation` with no schema change.

**Independent Test**: Grade an essay end-to-end with fake providers; assert the persisted `Evaluation` has five justifications, non-empty `generalFeedback`, and anchored annotations, and the results page renders all sections as today.

### Tests for User Story 2

- [X] T012 [P] [US2] Update/extend `tests/unit/grading-schema.test.ts` for the feedback-only Zod schema (five justifications, generalFeedback, annotations) and the `"none" → null` remap; keep the existing consistency-invariant tests passing.
- [X] T013 [P] [US2] Integration test in `tests/integration/submissions.test.ts`: full grading flow with split fakes persists five justifications + generalFeedback + anchored annotations and marks the submission `completed`.

### Implementation for User Story 2

- [X] T014 [P] [US2] Add the feedback-only Zod schema in `src/modules/grading/schema.ts` (justifications `{1..5}`, `generalFeedback`, `annotations`, `zeroReason`) and retain `validateEvaluationConsistency` (five competencies; annulled ⇒ all zero applied at merge).
- [X] T015 [P] [US2] Create `src/modules/grading/feedbackPrompt.ts` — instruct the model that the five scores are final (never change them), produce per-competency justifications + generalFeedback + annotations; include the raw Gemini feedback JSON schema (with the `"none"` sentinel) per `contracts/feedback-call.md`.
- [X] T016 [US2] Implement `GeminiGradingProvider.generateFeedback()` in `src/modules/grading/llm.ts`: model `business.feedbackModelId` (flash-lite), thinking off, `temperature=0`, structured JSON, input = theme + essay + fixed scores + annulled flag; remap `"none" → null` before Zod. (depends T014, T015)
- [X] T017 [US2] Split the fake feedback queue (`enqueueFakeFeedbackResult` + `defaultFakeFeedbackResult`) in `src/modules/grading/llm.ts`, and leave `AnthropicGradingProvider.generateFeedback()` as a throwing stub (Gemini-only, per T009 rationale). (depends T014, T015)
- [X] T018 [US2] Rewire `evaluateSubmission` in `src/modules/grading/index.ts` to orchestrate `scoreEssay()` → `generateFeedback()` → merge into `Evaluation`/`Annotation` (reuse `anchorAnnotations`, keep the `low_annotation_count` warning), write `rubricVersion = "2.0.0"` and a combined `modelId` (`score:…+fb:…`); preserve the in-code insufficient-text short-circuit; remove the now-dead `grade()` call. (depends T016, T017)

**Checkpoint**: Product works end-to-end with the two-call pipeline; UI unchanged; no migration.

---

## Phase 5: User Story 3 - Correct annulment reason (Priority: P2)

**Goal**: Annulled essays persist the specific 3-way `zeroReason`, classified by the feedback call.

**Independent Test**: Grade essays for each annulment reason; assert `Evaluation.zeroReason` matches and the results page shows the corresponding message.

### Tests for User Story 3

- [X] T019 [P] [US3] Tests in `tests/integration/submissions.test.ts` (and/or `tests/unit/grading-schema.test.ts`): annulled essay → `zeroReason` ∈ {`insufficient_text`,`genre_disregard`,`theme_disconnection`}, all five scores 0, `generalFeedback` explains it; non-annulled → `zeroReason` null.

### Implementation for User Story 3

- [X] T020 [US3] In `src/modules/grading/feedbackPrompt.ts` + `src/modules/grading/schema.ts`: make the feedback call classify `zeroReason` when `annulled` is true (one of the three enum values) and return `"none"`/null otherwise; the feedback call must not flip the annulled decision. (depends T015, T018)
- [X] T021 [US3] In `src/modules/grading/index.ts`: on annulled, force all persisted scores to 0 and store the classified `zeroReason`; confirm every enum value is covered by the UI `ZERO_REASON_MESSAGES` map in `src/app/(app)/submissions/[id]/page.tsx` (read-only check; no UI change expected). (depends T018, T020)

**Checkpoint**: Annulment reason granularity restored and rendered.

---

## Phase 6: User Story 4 - Feedback failure never wastes a validated score (Priority: P3)

**Goal**: A feedback-call failure persists the validated scores with fallback feedback, without refunding or re-scoring.

**Independent Test**: Force `generateFeedback()` to fail after retries; assert the submission completes with the real scores + placeholder feedback, credit retained, no scoring re-call.

### Tests for User Story 4

- [X] T022 [P] [US4] Test in `tests/integration/submissions.test.ts`: enqueue a failing fake feedback result → submission `completed` with real scores + placeholder justifications/generalFeedback (`zeroReason = theme_disconnection` iff annulled), credit **not** refunded; and the existing call-1-failure test still yields `failed` + refund.

### Implementation for User Story 4

- [X] T023 [US4] In `src/modules/grading/index.ts`: wrap `generateFeedback()` in a bounded retry (reuse `withRetry`, ≤3 attempts); on exhaustion build a synthetic `FeedbackResult` (placeholder sentence per competency, non-empty placeholder `generalFeedback` stating the detailed automatic reason was unavailable, empty annotations, `zeroReason = theme_disconnection` iff annulled else null — documented degraded default), persist with the real scores, mark `completed`, no refund. Keep call-1 failure on the existing `failSubmission` (fail + refund + weekly-entry removal) path. (depends T018)

**Checkpoint**: Degradation path proven; no completed evaluation ever loses validated scores.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T024 [P] Update `tests/unit/grading-provider.test.ts` for the split provider (scoreEssay + generateFeedback fakes); ensure `tests/unit/anchoring.test.ts` still passes unchanged.
- [X] T025 Run the full test suite + typecheck + lint (`pnpm vitest run`, `pnpm tsc --noEmit`, lint) and fix any breakage.
- [X] T026 SC-001 validation run by the user out-of-band on a different dataset (v5 QWK reproduction confirmed there); no in-session re-run needed.
- [X] T027 [P] Reconcile the harness mirror: update `scripts/eval/variants/baseline.ts` note (and any JSON-schema mirror) if the feedback schema split affects it; confirm `parseGeminiEvaluation` usage is untouched for non-v5 variants.
- [X] T028 Measured live: two-call latency median 28.4s / max 36.8s vs 60s budget → PASS (SC-005). Quota NOT exhausted (no model switch). See `scripts/eval/results/t028-latency.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup — BLOCKS all stories (T003 types, T004 interface).
- **US1 (Phase 3)**: after Foundational. MVP — independently measurable via the harness.
- **US2 (Phase 4)**: after Foundational; depends on US1's `scoreEssay()` (T008/T010) to wire the full pipeline in T018.
- **US3 (Phase 5)**: after US2 (extends the feedback prompt/schema and the orchestration in T018).
- **US4 (Phase 6)**: after US2 (wraps the T018 orchestration).
- **Polish (Phase 7)**: after all desired stories.

### Within Each User Story

- Tests before implementation (verify they fail first).
- `scoreParser`/`scoringPrompt` (files) before `scoreEssay()` (llm.ts) in US1.
- feedback schema/prompt before `generateFeedback()` before orchestration in US2.

### Parallel Opportunities

- Setup: T001 ∥ T002 (different files).
- US1: T005, T006, T007, T011 are [P] (distinct files); T008/T009/T010 are sequential (all edit `llm.ts`).
- US2: T012, T013, T014, T015 are [P]; T016/T017/T018 sequential (edit `llm.ts`/`index.ts`).
- Cross-story: US3 and US4 both extend `index.ts` from US2, so run them sequentially, not in parallel.

---

## Parallel Example: User Story 1

```bash
# After Foundational (T003, T004):
Task: "Unit tests for score parser in tests/unit/score-parser.test.ts"           # T005
Task: "Copy v5 verbatim into src/modules/grading/scoringPrompt.ts"               # T006
Task: "Implement scoreParser.ts per contracts/scoring-call.md"                   # T007
Task: "Add v5-scoring eval variant in scripts/eval/variants/v5-scoring.ts"       # T011
# Then sequentially in llm.ts: T008 → T009 → T010
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1.
2. **STOP and VALIDATE**: run the harness (T026 method) — confirm QWK reproduces ≈0.54 and beats baseline. This is the core value; if it does not reproduce, halt before wiring the product.

### Incremental Delivery

1. US1 (scores validated via harness) — proves the calibration transfers.
2. US2 (feedback + persistence) — restores the full product on the two-call path (shippable).
3. US3 (annulment reason) — restores zeroReason granularity.
4. US4 (graceful degradation) — hardening.
5. Polish — full suite green + SC-001 recorded.

---

## Notes

- [P] = different files, no incomplete dependencies. `llm.ts` and `index.ts` are shared hot files — tasks touching them are sequential.
- No Prisma migration and no UI component change in any task (SC-003).
- v5 prompt is copied verbatim (T006) and frozen; `enem_db/` is never a runtime dependency.
- Nothing is committed by these tasks unless the user requests it.
