# Phase 0 Research: Two-Call Calibrated Grading Pipeline

All open questions from the spec's Clarifications session are resolved below. No
outstanding NEEDS CLARIFICATION.

## R1 — Scoring model & runtime config

- **Decision**: Call 1 runs `v5_calibrated.md` **verbatim** on `gemini-2.5-flash` with
  dynamic thinking (`thinking_budget=-1`), `maxOutputTokens=32768`, `temperature=0`.
- **Rationale**: The fine-tuning repo (`enem_db/fine_tuning`) measured this exact config at
  global QWK **0.541** (`results/summary.md`), the best of all v0–v5 variants. Two facts
  make the config non-negotiable: (a) turning thinking ON is responsible for the largest
  single jump (v2→v3: mean QWK 0.371→0.462); (b) v4 raised the output cap 8192→32768
  specifically because a long think was truncating the trailing score block. Today's
  production default (`gemini-3.1-pro-preview`, no thinking, 8192 cap) would not reproduce
  the number.
- **Alternatives considered**: `gemini-2.5-pro` with the same prompt (`v5_calibrated_pro`)
  scored *lower* (0.494) — more capable model, worse rank agreement — so pro is rejected.
  Keeping `gemini-3.1-pro-preview` is rejected: unvalidated for v5 and carries the ~270/day
  quota cap noted in prior project memory.

## R2 — Why two calls (not merge, not scores-only)

- **Decision**: Keep v5 untouched as a scores-only call; add a second call for the rich
  feedback fields the product renders.
- **Rationale**: v5 emits only `ANNULLED` + five scores. Production persists and displays
  four fields v5 never produces — per-competency `justification`, `generalFeedback`,
  `annotations`, and a 3-way `zeroReason`. Merging v5 into the JSON schema would edit the
  frozen, validated artifact (forbidden) and likely suppress the free-form reasoning that
  the calibration depends on. A scores-only swap would blank three UI sections and collapse
  `zeroReason` to a binary. Two calls preserves both the validated scores and the product.
- **Alternatives considered**: *Merge into JSON schema* — rejected (edits the frozen prompt;
  needs re-validation; risks losing the thinking-driven gain). *Scores-only + drop features*
  — rejected (product regression, UI/DB churn).

## R3 — Score-block parsing (call 1 output)

- **Decision**: Call 1 uses **no** structured/JSON output. A dedicated parser extracts the
  trailing block:

  ```
  ANNULLED: <yes|no>
  C1..C5: <0|40|80|120|160|200>
  ```

  It reads the **last** occurrence of each labeled line (the block is the tail, after
  reasoning), validates every score against the allowed set, and on `ANNULLED: yes` forces
  all five scores to 0. Any missing/invalid field → call-1 failure (no inferred score).
- **Rationale**: v5's calibration lives in free-form reasoning ending in the block;
  `responseJsonSchema`/`zodOutputFormat` would suppress that. Parsing the tail is a small,
  testable function. "Last occurrence" guards against the labels appearing inside the
  reasoning prose.
- **Alternatives considered**: Forcing structured output (rejected — defeats the tuned
  behavior). Lenient parsing that guesses on partial blocks (rejected — FR-005 forbids
  persisting inferred scores).

## R4 — Feedback model, input, and `zeroReason` ownership

- **Decision**: Call 2 runs on `gemini-2.5-flash-lite`, no thinking, **structured JSON**.
  Input = theme + essay + the five final scores + the annulled flag (not call 1's reasoning
  trace). It owns `zeroReason`: when annulled it classifies exactly one of
  `insufficient_text` / `genre_disregard` / `theme_disconnection`; otherwise `zeroReason`
  is null. It never changes a score.
- **Rationale**: Call 2 is explanatory, not score-critical, so the cheapest/fastest tier is
  appropriate. Passing only the final scores keeps it clean and avoids depending on thinking
  traces (not dependably returned by the API). Structured output is fine here because there
  is no calibrated free-text block to preserve.
- **Alternatives considered**: `flash` (marginally better prose, higher cost — reserve as a
  fallback if flash-lite classification proves weak); a pro model (rejected — pro-tier cost
  on every submission for non-scoring text). Forwarding call-1 reasoning (rejected — bulk +
  coupling + unreliable trace availability).

## R5 — Failure handling & graceful degradation

- **Decision**: If call 1 succeeds and call 2 fails after a small retry budget, persist the
  validated scores, mark the submission **completed**, and do **not** refund. Feedback
  fields fall back to safe placeholder text; if the essay was annulled and classification
  failed, use a **generic** annulment reason. If call 1 itself fails, keep today's behavior:
  mark failed, refund credit, remove weekly entry.
- **Rationale**: The scoring call is the expensive, validated, high-value step; discarding it
  because the cheap explanatory call failed wastes compute, refunds a correctly-scored essay,
  and re-runs the scorer on retry. The existing consistency invariants still hold (five
  competencies; annulled ⇒ all zero).
- **Open design detail (for tasks)**: retry count for call 2 (proposal: reuse existing
  `withRetry`, ≤3 attempts) and the exact placeholder strings. `generalFeedback` is a
  non-null column, so the fallback must be a real sentence, not empty.
- **Alternatives considered**: Fail+refund on any failure (rejected — wastes validated
  scores). Retry call 2 indefinitely (rejected — a persistently failing feedback call would
  wedge the submission in `grading`).

## R6 — Persistence, versioning, and cost

- **Decision**: Merge both results into the **existing** `Evaluation`/`Annotation` shape (no
  Prisma migration). Bump `RUBRIC_VERSION` to **2.0.0** (grading semantics changed).
  `Evaluation.modelId` records **both** models (scoring + feedback). One credit per
  submission unchanged. The in-code minimum-line short-circuit stays and skips both calls.
- **Rationale**: Keeping the persisted shape identical is what makes the UI and DB untouched
  (SC-003). A major version bump keeps historical single-call evaluations interpretable
  alongside the new ones. Recording both models keeps provenance for future drift analysis.
- **Alternatives considered**: New columns for the two model IDs / two prompt versions
  (rejected — migration + churn for marginal benefit; a combined `modelId` string and single
  `rubricVersion` suffice).

## R7 — Prompt asset location

- **Decision**: Copy `v5_calibrated.md` into the app as a module-local TypeScript asset
  (`src/modules/grading/scoringPrompt.ts`), with a builder that replicates the validated
  harness `render()`: strip `{{THEME}}`/`{{ESSAY}}` from the system instruction and send
  theme+essay as a separate, fixed-format user turn (`THEME (motivating text):` / `ESSAY:`).
  Do not substitute into the prompt body.
- **Rationale**: The fine-tuning repo (`enem_db/`) must not be a runtime dependency
  (Principle II/III). A single in-repo copy is the source of truth; any future prompt change
  is a separate versioned change. Keeping the essay in the user content (not the system
  prefix) preserves prompt caching of the large, stable v5 prefix (anchors + exemplars).
- **Alternatives considered**: Reading the `.md` from the sibling repo at runtime (rejected —
  cross-repo coupling, breaks in deployment). Inlining the whole prompt in `llm.ts` (rejected
  — mixes a large static asset with provider logic).

## R8 — Eval-harness reproducibility (non-blocking)

- **Decision**: Optionally add a `scripts/eval/variants/` entry that runs v5 with the same
  score-block parser, so SC-001 can be confirmed on this app's held-out set via
  `report.py` / `compare.py` before launch.
- **Rationale**: The harness's existing `parseGeminiEvaluation` expects JSON; the v5 variant
  needs the new plain-text parser to be measured. This is validation tooling, out of the
  production hot path, but required to satisfy SC-001.
- **Alternatives considered**: Trusting the external number without re-validating on the
  app's runtime (rejected — the spec's SC-001 requires an on-app paired check).
