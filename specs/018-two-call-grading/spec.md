# Feature Specification: Two-Call Calibrated Grading Pipeline

**Feature Branch**: `018-two-call-grading`

**Created**: 2026-07-30

**Status**: Draft

**Input**: Adopt the externally-tuned `v5_calibrated` grading prompt (validated at global
QWK 0.541 on `gemini-2.5-flash` with dynamic thinking) as the production scorer, without
losing the product's per-competency justifications, general feedback, and inline
annotations. Because `v5_calibrated` only emits five scores plus an annulment flag, split
grading into two model calls: a **scoring call** (v5 verbatim) and a **feedback call** that
explains the already-fixed scores and classifies the annulment reason. The persisted
evaluation shape, the DB schema, and the submission-results UI stay unchanged.

## Clarifications

### Session 2026-07-30

- Q: How to reconcile v5's scores-only output with the product's rich feedback? → A: Two-call pipeline (v5 verbatim for scores; a second call for justifications/feedback/annotations). v5 is never edited or merged.
- Q: Who owns the 3-way `zeroReason` classification, since v5 only emits `ANNULLED: yes/no`? → A: The feedback call (call 2).
- Q: Which runtime config for the scoring call? → A: The validated one exactly — `gemini-2.5-flash`, dynamic thinking (`thinking_budget=-1`), `maxOutputTokens=32768`, `temperature=0`. Replaces the current `gemini-3.1-pro-preview` default.
- Q: Call 1 succeeds but call 2 fails/times out? → A: Persist the validated scores and mark the submission completed with degraded (fallback) feedback; never discard scores, never refund a correctly-scored essay.
- Q: Which model for call 2? → A: `gemini-2.5-flash-lite`, no thinking, structured JSON output.
- Q: What input does call 2 receive? → A: Essay + theme + the final five scores + annulled flag. It re-reads the essay; it does not receive call 1's reasoning trace.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accurate, consistent competency scores (Priority: P1)

A student submits a confirmed essay transcription. The grading pipeline scores it with the
`v5_calibrated` prompt under its validated runtime settings, yielding the five ENEM
competency scores and the total.

**Why this priority**: Score accuracy is the product's core promise and the entire reason
for adopting v5. The tuned prompt raised global QWK from the current production baseline
(~0.43) to 0.541 — the single biggest available quality gain.

**Independent Test**: Run the scoring call on the held-out set and compute QWK vs human
ground truth; confirm it reproduces the validated number and beats the current baseline
with `compare.py` paired-bootstrap confidence.

**Acceptance Scenarios**:

1. **Given** a valid on-theme dissertative-argumentative essay, **When** it is graded, **Then** each competency receives a value in {0,40,80,120,160,200}, the total is their sum, and the scores match what the v5 prompt produced under its validated config.
2. **Given** the scoring model returns free-form reasoning followed by the `ANNULLED/C1..C5` block, **When** the response is parsed, **Then** the five scores and the annulment flag are extracted and every score is validated against the allowed set.
3. **Given** an essay under the minimum line count, **When** grading starts, **Then** the existing in-code short-circuit assigns zero without calling either model.

---

### User Story 2 - Rich feedback preserved (Priority: P1)

The student opens the results page and still sees a per-competency justification, a general
feedback paragraph, and inline highlighted annotations on their essay — exactly as today.

**Why this priority**: Without call 2 the product regresses hard: three visible feedback
sections go blank and the results page loses most of its value. Preserving them is
non-negotiable for shipping.

**Independent Test**: Grade a sample essay end-to-end with fakes/real calls and assert the
persisted `Evaluation` has non-empty `justifications` (all five competencies),
`generalFeedback`, and at least the expected annotations; render the results page and
confirm all sections populate.

**Acceptance Scenarios**:

1. **Given** a non-annulled essay with computed scores, **When** the feedback call runs, **Then** it returns one justification per competency, a general-feedback paragraph, and annotations whose `excerpt` values are literal substrings of the essay.
2. **Given** the feedback call output, **When** it is persisted, **Then** the `Evaluation` and `Annotation` rows have the identical shape they have today (no schema change) and annotations are anchored by the existing anchoring step.
3. **Given** an annotation excerpt that is not found verbatim in the essay, **When** anchoring runs, **Then** it is stored unanchored (offsets null) exactly as in current behavior.

---

### User Story 3 - Correct annulment reason (Priority: P2)

An annulled essay (off-theme, wrong genre, copied, etc.) shows the student the specific
reason for the zero, not a generic message.

**Why this priority**: v5 collapses annulment to a binary flag, but the DB enum and the UI
message map expect one of three reasons. The feedback call restores that granularity.

**Independent Test**: Grade essays representing each annulment reason and assert the
persisted `zeroReason` matches, and the results page shows the corresponding message.

**Acceptance Scenarios**:

1. **Given** the scoring call returns `ANNULLED: yes`, **When** the feedback call runs, **Then** it classifies the reason as one of `insufficient_text` / `genre_disregard` / `theme_disconnection`, all five scores are persisted as 0, and `generalFeedback` explains the annulment.
2. **Given** the scoring call returns `ANNULLED: no`, **When** the evaluation is persisted, **Then** `zeroReason` is null and competencies are scored on their merits.
3. **Given** the in-code insufficient-text short-circuit fires, **When** the evaluation is built, **Then** `zeroReason` is `insufficient_text` without any model call (unchanged behavior).

---

### User Story 4 - Feedback failure never wastes a validated score (Priority: P3)

If the scoring call succeeds but the feedback call fails or times out, the student still
receives their (correct) scores; the credit is not refunded and the essay is not re-graded
from scratch.

**Why this priority**: The scoring call is the expensive, validated, high-value step.
Throwing it away because the cheap explanatory call failed would waste compute, refund a
correctly-scored essay, and re-run the scorer on retry.

**Independent Test**: Force the feedback call to fail after a successful scoring call;
assert the submission completes with the real scores and fallback feedback, the credit is
retained, and no scoring re-call occurs.

**Acceptance Scenarios**:

1. **Given** call 1 succeeded and call 2 fails after its retries, **When** the evaluation is persisted, **Then** the five scores are the validated scores, the submission is marked completed, and the credit is not refunded.
2. **Given** call 2 degraded to fallback, **When** the results page renders, **Then** competency scores display normally and feedback fields show a clear, non-broken placeholder (and, if the essay was annulled, the `theme_disconnection` message plus a note that the detailed automatic reason was unavailable).
3. **Given** call 1 itself fails, **When** grading errors out, **Then** the current failure behavior is unchanged: submission marked failed, credit refunded, weekly entry removed.

---

### Edge Cases

- **Malformed / missing score block**: scoring response has no parseable `ANNULLED/C1..C5` block, or a value outside {0,40,80,120,160,200} → treat as a call-1 failure (fail + refund path), never persist a guessed score.
- **Thinking truncation**: a long reasoning trace consumes the output budget before the score block is emitted → the 32768 cap is mandatory; a truncated response with no score block is a call-1 failure.
- **Annulment disagreement**: call 2 is told the essay was annulled; it does not override the binary decision — call 1's `ANNULLED` is authoritative, call 2 only classifies the reason.
- **DH violation in C5**: a human-rights-violating intervention scores 0 on C5 only (not whole-essay annulment) — governed by v5's C5 procedure; the feedback call must not re-annul.
- **Annulled + feedback failure**: if call 2 fails on an annulled essay, persist zeros with the documented degraded default `zeroReason = theme_disconnection` rather than blocking completion.
- **Both models unavailable in region**: same diagnostic-context failure surfaced today for Vertex model/region availability.

## Requirements *(mandatory)*

### Functional Requirements

**Scoring call (call 1)**

- **FR-001**: The system MUST use the `v5_calibrated` prompt text **verbatim** as the scoring prompt; it MUST NOT be edited, merged with the legacy rubric, or paraphrased. A single copy lives in the app source (the fine-tuning repo is not a runtime dependency).
- **FR-002**: The scoring call MUST run under the validated runtime config: model `gemini-2.5-flash`, dynamic thinking (`thinking_budget=-1`), `maxOutputTokens=32768`, `temperature=0`. These MUST be the production defaults for the scoring call.
- **FR-003**: The scoring call MUST substitute the essay theme and confirmed transcription into the prompt's `{{THEME}}` / `{{ESSAY}}` placeholders and MUST NOT request structured/JSON output (v5's calibration depends on free-form reasoning ending in a plain-text block).
- **FR-004**: The system MUST parse the trailing `ANNULLED: <yes|no>` + `C1..C5:` block from the scoring response, validating every score against {0,40,80,120,160,200}; on `ANNULLED: yes` all five scores MUST be 0.
- **FR-005**: A scoring response with no parseable, fully-valid score block MUST be treated as a grading failure (existing fail + refund path); the system MUST NOT persist an inferred or defaulted score.

**Feedback call (call 2)**

- **FR-006**: After scores are fixed, the system MUST make a second call using model `gemini-2.5-flash-lite`, no thinking, with structured JSON output.
- **FR-007**: The feedback call MUST receive the theme, the essay, the five final scores, and the annulled flag; it MUST NOT receive call 1's reasoning trace and MUST NOT change any score.
- **FR-008**: For a non-annulled essay the feedback call MUST return one justification per competency (all five), a general-feedback paragraph, and inline annotations (`competency`, literal `excerpt`, `issue`, `suggestion`).
- **FR-009**: The feedback call MUST own `zeroReason` classification: when the essay is annulled it MUST classify the reason as exactly one of `insufficient_text` / `genre_disregard` / `theme_disconnection`; when not annulled `zeroReason` MUST be null.
- **FR-010**: Annotation excerpts MUST be reused by the existing anchoring step to compute highlight offsets; unfound excerpts remain unanchored, unchanged from today.

**Assembly, persistence, versioning**

- **FR-011**: The system MUST merge the scoring result and the feedback result into the existing `Evaluation` + `Annotation` records with an **identical persisted shape** — no Prisma schema change and no data migration.
- **FR-012**: `RUBRIC_VERSION` MUST be bumped to a new major version (2.0.0) because grading semantics change; the value MUST continue to be stored on every `Evaluation`.
- **FR-013**: `Evaluation.modelId` MUST record both models used (scoring and feedback), so historical evaluations remain interpretable.
- **FR-014**: The in-code minimum-line-count short-circuit MUST be preserved and MUST continue to skip both model calls, producing an `insufficient_text` zero.
- **FR-015**: Credit accounting MUST be unchanged: one credit per submission regardless of the two internal calls.

**Failure handling**

- **FR-016**: If call 1 succeeds and call 2 fails after its retries, the system MUST persist the validated scores, mark the submission completed, and NOT refund the credit; feedback fields MUST fall back to safe placeholder text. When annulled, `zeroReason` MUST default to `theme_disconnection` (the most frequent structural annulment; `insufficient_text` is already handled pre-call-2), and `generalFeedback` MUST state that the detailed automatic reason was unavailable for this correction.
- **FR-017**: If call 1 fails, the system MUST apply the current failure behavior: mark failed, refund the credit, remove the weekly entry.
- **FR-018**: The persisted evaluation MUST always satisfy the existing consistency invariants (exactly five competencies 1–5; annulment implies all scores 0).

**Testing surface**

- **FR-019**: The deterministic fake grading provider MUST be split to cover both calls so existing unit/integration tests (which enqueue fake grading results) keep working without external calls.
- **FR-020**: The new score-block parser and the degraded-feedback path MUST have unit coverage; the output-schema consistency tests MUST continue to pass unchanged.

### Key Entities

- **ScoringResult**: output of call 1 — the annulled flag and five competency scores. Ephemeral; not persisted on its own.
- **FeedbackResult**: output of call 2 — five per-competency justifications, general feedback, annotations, and the classified `zeroReason`. Ephemeral; merged into `Evaluation`.
- **Evaluation** (existing, unchanged): `scoreC1..C5`, `totalScore`, `justifications`, `generalFeedback`, `zeroReason`, `rubricVersion`, `modelId`, related `annotations`.
- **Annotation** (existing, unchanged): `competency`, `excerpt`, offsets, `anchored`, `issue`, `suggestion`.
- **zeroReason** (existing enum, unchanged): `insufficient_text` / `genre_disregard` / `theme_disconnection`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the held-out evaluation set, the scoring call reproduces the validated v5 quality (global QWK ≈ 0.54) and beats the current production baseline with `compare.py` paired-bootstrap confidence.
- **SC-002**: 100% of completed evaluations retain all five real scores even when the feedback call degrades — no completed evaluation ever shows placeholder/zeroed scores due to a feedback failure.
- **SC-003**: Zero database migrations and zero changes to the submission-results UI components are required to ship (persisted shape identical).
- **SC-004**: For a labeled annulment sample, the feedback call's `zeroReason` is a valid 3-way value in 100% of cases and matches the human annulment reason at a rate ≥ the legacy single-call prompt's, measured via the eval harness (not asserted in unit tests).
- **SC-005**: End-to-end grading (both calls) completes within the existing background-task duration budget on the deployment platform, with no increase in grading-timeout failures.
- **SC-006**: Per-submission model cost stays in the flash / flash-lite tier (no pro-tier call on the hot path).

## Assumptions

- `v5_calibrated.md` is adopted **verbatim and frozen**; any future change to it is a separate versioned change, not part of this feature.
- The v5 validation (QWK 0.541 on `gemini-2.5-flash` + dynamic thinking) transfers to this app's Vertex AI runtime; SC-001 re-confirms it on the app's own held-out set before launch.
- `gemini-2.5-flash-lite` produces acceptable explanatory prose and reliable `zeroReason` classification for annulled essays; this is explanatory, not scoring, text.
- The grading input remains the confirmed transcription (`confirmedText`); theme text is available on the submission.
- The Vertex AI service account, region, and quota support `gemini-2.5-flash` (with thinking) and `gemini-2.5-flash-lite`.
- The existing credit, weekly-ranking, and background-task mechanisms are reused unchanged.

## Out of Scope

- Any change to the v5 prompt wording, the legacy rubric descriptors, or the competency rubric itself.
- Database schema / migration changes and any redesign of the submission-results UI.
- Re-tuning or re-searching the grading prompt (that is the separate `011-grading-prompt-search` effort); this feature only productionizes an already-selected prompt.
- Changing the OCR/transcription pipeline or the credit/billing model.
- Backfilling or re-grading historical evaluations produced under `rubricVersion` 1.0.0.
