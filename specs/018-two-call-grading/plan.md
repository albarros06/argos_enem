# Implementation Plan: Two-Call Calibrated Grading Pipeline

**Branch**: `018-two-call-grading` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-two-call-grading/spec.md`

## Summary

Replace the single-call structured-JSON grader with a two-call pipeline. **Call 1
(scoring)** runs the externally-tuned `v5_calibrated` prompt verbatim on
`gemini-2.5-flash` with dynamic thinking (validated at global QWK 0.541) and emits five
competency scores plus an `ANNULLED` flag via a plain-text block. **Call 2 (feedback)**
runs on `gemini-2.5-flash-lite`, receives the essay + theme + fixed scores, and produces
the per-competency justifications, general feedback, inline annotations, and the 3-way
`zeroReason` classification the product needs. The two results merge into the **existing**
`Evaluation`/`Annotation` shape — no schema migration, no UI change. A feedback-call
failure degrades gracefully (persist validated scores, never refund).

## Technical Context

**Language/Version**: TypeScript 5 / Node (Next.js 15 App Router, React 19)

**Primary Dependencies**: `@google/genai` (Vertex AI, via `src/lib/vertex.ts`) for both
model calls; `@anthropic-ai/sdk` (existing alternate provider, retained); `zod` (feedback
output validation); Prisma (Postgres). No new dependency.

**Storage**: Postgres via Prisma. Models `Evaluation` + `Annotation` — **unchanged**.

**Testing**: Vitest (`tests/unit`, `tests/integration`) with the deterministic fake
grading provider; Python eval harness (`scripts/eval/`) for QWK/`compare.py` validation.

**Target Platform**: Vercel (Next.js server + background tasks via `scheduleBackgroundTask`).

**Project Type**: Web application (single Next.js app; grading is a server-side module).

**Performance Goals**: End-to-end grading (two sequential calls) within the existing
background-task duration budget; scoring call ~27s + ~5k thinking tokens observed in tuning;
no increase in grading-timeout failures (SC-005). Both calls stay in flash / flash-lite tier
(SC-006).

**Constraints**: Scoring call MUST use `thinking_budget=-1` and `maxOutputTokens=32768`
(truncated thinking drops the score block); `temperature=0` for reproducibility. Persisted
evaluation shape identical to today (SC-003). One credit per submission (FR-015).

**Scale/Scope**: Per-submission grading path; ~7 source files touched in
`src/modules/grading/` + `src/lib/config.ts`; no migration; no UI component change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Código Legível Primeiro** | PASS. Two named provider methods (`scoreEssay`, `generateFeedback`) with single responsibilities; the score-block parser is a small named function. No clever constructs. |
| **II. Estrutura Simples** | PASS. No new dependency, no new abstraction layer — reuses `gradingProvider()`, `withRetry`, `logger.vendorCall`, `anchorAnnotations`. Two calls is the minimum that satisfies "v5 verbatim + keep the product," not speculative. |
| **III. Modularidade Obrigatória** | PASS. All change stays inside the `grading` module's existing public surface (`evaluateSubmission`); no other module reaches in. Prompt assets stay module-local. |
| **IV. Manutenibilidade** | PASS. The persisted contract and UI are untouched, minimizing blast radius; version bump keeps history interpretable. |
| **V. Preparado para Escala** | PASS. Grading already runs off-request via `scheduleBackgroundTask` (stateless, isolated behind the provider interface); the second call sits behind the same interface, preserving cache/queue options. |

No violations → Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/018-two-call-grading/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── scoring-call.md      # Call 1 prompt I/O + score-block grammar
│   └── feedback-call.md     # Call 2 JSON schema + zeroReason classification
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/modules/grading/
├── rubric.ts            # LEGACY single-call prompt — retained but no longer the hot path;
│                        #   RUBRIC_VERSION bumped to 2.0.0 (moves here or to a version const)
├── scoringPrompt.ts     # NEW: v5_calibrated.md verbatim + {{THEME}}/{{ESSAY}} builder
├── scoreParser.ts       # NEW: parse/validate the ANNULLED + C1..C5 plain-text block
├── feedbackPrompt.ts    # NEW: call-2 prompt (explains fixed scores, classifies zeroReason)
├── schema.ts            # feedback-only Zod schema (justifications/generalFeedback/annotations
│                        #   + zeroReason); existing consistency checks retained
├── llm.ts               # provider split: scoreEssay() (no structured output) +
│                        #   generateFeedback() (structured); Gemini/Anthropic/Fake updated
├── anchoring.ts         # REUSED unchanged
└── index.ts             # evaluateSubmission orchestrates call 1 → call 2 → merge/persist,
                         #   with degraded-feedback fallback

src/lib/config.ts        # scoring vs feedback model IDs + token/thinking settings

tests/unit/              # scoreParser, feedback schema, degraded path, split fakes
tests/integration/       # submissions flow with split fake providers
scripts/eval/variants/   # (optional) v5 variant to reproduce QWK with the new parser
```

**Structure Decision**: Single Next.js web app; all grading logic remains within the
existing `src/modules/grading/` module boundary. The v5 prompt is copied into the app as a
module-local asset (`scoringPrompt.ts`) — the fine-tuning repo (`enem_db/`) is **not** a
runtime dependency. No cross-module changes; UI and Prisma untouched.

## Complexity Tracking

> No Constitution Check violations — section intentionally empty.
