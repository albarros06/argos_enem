---
description: "Task list for Migrate Gemini Grading Provider to Vertex AI"
---

# Tasks: Migrate Gemini Grading Provider to Vertex AI

**Input**: Design documents from `/specs/004-vertex-ai-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/grading-provider.md, quickstart.md

**Tests**: Included. The plan and contract explicitly define test tasks, and SC-005 (suite passes with zero Google Cloud calls) is a measurable success criterion.

**Organization**: Tasks are grouped by user story. This is a small, tightly-scoped migration; User Stories 1–2 both modify `src/modules/grading/llm.ts`, so US2 depends on US1. US3 (dev/CI + docs) is largely independent.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in each description

## Path Conventions

Single-project Next.js layout: `src/`, `tests/` at repository root (per plan.md Structure Decision).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm prerequisites; no new dependency is introduced.

- [X] T001 Verify `@google/genai` `^2.11.0` is present in `package.json` and no new dependency is required (Vertex mode is supported by the installed SDK per research.md R1).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configuration and server-bundling changes that BOTH the Vertex path (US1) and the dev/CI path (US3) depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Update env schema in `src/lib/config.ts`: add `GOOGLE_CLOUD_LOCATION` (string, default `"us-central1"`) and `GOOGLE_CLOUD_PROJECT` (string, default `""`); remove `GEMINI_API_KEY` from the schema.
- [X] T003 [P] Add `"@google/genai"` to `serverExternalPackages` in `next.config.ts`, alongside the existing `"@google-cloud/vision"` entry (research.md R7).

**Checkpoint**: Config exposes region/project and drops the API key; SDK is externalized. User stories can now begin.

---

## Phase 3: User Story 1 - Operator Runs Grading Through Vertex AI (Priority: P1) 🎯 MVP

**Goal**: Gemini-model grading authenticates and bills through the existing Google Cloud service account via Vertex AI, in region `us-central1`.

**Independent Test**: With only `GOOGLE_APPLICATION_CREDENTIALS_JSON` set (no `GEMINI_API_KEY`) and `GRADING_MODEL_ID=gemini-*`, submit an essay and confirm it is graded and the request authenticates through the service account under the credential's project.

### Tests for User Story 1

- [X] T004 [P] [US1] Create `tests/unit/grading-provider.test.ts` asserting: (a) `gradingProvider()` selection — `gemini-*` → `GeminiGradingProvider`, `claude-*` → Anthropic, `FAKE_VENDORS=1` → fake; (b) `GeminiGradingProvider` constructs `GoogleGenAI` with `vertexai: true`, the derived project, and `location` defaulting to `us-central1` (spy/mock the `@google/genai` constructor).

### Implementation for User Story 1

- [X] T005 [US1] In `src/modules/grading/llm.ts`, rewrite `GeminiGradingProvider` client construction to Vertex mode: `new GoogleGenAI({ vertexai: true, project, location, googleAuthOptions: { credentials } })`, where `credentials = JSON.parse(env().GOOGLE_APPLICATION_CREDENTIALS_JSON)` and `location = env().GOOGLE_CLOUD_LOCATION`; remove the `apiKey: env().GEMINI_API_KEY` usage (contracts/grading-provider.md §2).
- [X] T006 [US1] In `src/modules/grading/llm.ts`, add effective-project resolution (`env().GOOGLE_CLOUD_PROJECT` if non-empty, else the parsed credential's `project_id`) and throw clear configuration errors (FR-008) when the credentials are missing/unparseable or the project cannot be determined.
- [X] T007 [US1] In `src/modules/grading/llm.ts`, confirm the `AnthropicGradingProvider` and `FakeGradingProvider` branches of `gradingProvider()` remain unchanged (US1 acceptance scenario 3 — Claude path unaffected).

**Checkpoint**: Gemini grading runs on Vertex AI with service-account auth. MVP is functional and testable.

---

## Phase 4: User Story 2 - Student Sees No Change in Grading Quality or Behavior (Priority: P2)

**Goal**: The returned `LlmEvaluation` (structure, scores, determinism, error handling) is identical to pre-migration output.

**Independent Test**: Grade a fixed benchmark set before/after; evaluation structure is identical and scores reproduce at temperature 0.

**Dependency**: Depends on US1 (same file, `src/modules/grading/llm.ts`).

### Tests for User Story 2

- [X] T008 [P] [US2] In `tests/unit/grading-schema.test.ts`, verify the `LlmEvaluation` contract is preserved: five competencies, valid score enum, and the `"none"` → `null` `zeroReason` remap followed by `llmEvaluationSchema.parse` (data-model.md runtime contract).

### Implementation for User Story 2

- [X] T009 [US2] In `src/modules/grading/llm.ts`, keep the `generateContent` request body unchanged: `systemInstruction` (frozen rubric), `responseMimeType: "application/json"`, `responseJsonSchema: GEMINI_EVALUATION_SCHEMA`, `temperature: 0`, `maxOutputTokens: 8192` (FR-004, FR-005).
- [X] T010 [US2] In `src/modules/grading/llm.ts`, preserve error handling for empty/blocked responses (`finishReason`) and invalid JSON so a malformed evaluation is never returned/persisted (contracts/grading-provider.md §4).
- [X] T011 [US2] In `src/modules/grading/llm.ts`, surface a clear error naming the model and region when the selected model is unavailable in the configured region (FR-012).

**Checkpoint**: Grading output contract and determinism verified unchanged on the Vertex backend.

---

## Phase 5: User Story 3 - Developer Runs App and Tests Without Google Cloud Access (Priority: P3)

**Goal**: Local dev and CI grade essays via the deterministic fake with no external calls; docs reflect the new config and the removal of `GEMINI_API_KEY`.

**Independent Test**: With `FAKE_VENDORS=1`, run the suite and a local grading flow — essays are graded by the fake with zero network calls; no Gemini API key required.

### Tests for User Story 3

- [X] T012 [P] [US3] Update `tests/unit/env-config.test.ts`: remove any `GEMINI_API_KEY` assumptions; assert `GOOGLE_CLOUD_LOCATION` defaults to `"us-central1"`; assert the effective project falls back to the credential's `project_id` when `GOOGLE_CLOUD_PROJECT` is empty.
- [X] T013 [P] [US3] In `tests/unit/grading-provider.test.ts`, add a case asserting that with `FAKE_VENDORS=1` grading uses `FakeGradingProvider` and makes no external calls (SC-005).

### Implementation for User Story 3

- [X] T014 [P] [US3] Update `.env.example`: remove `GEMINI_API_KEY`; document `GOOGLE_CLOUD_LOCATION` (default `us-central1`) and optional `GOOGLE_CLOUD_PROJECT`; update the `GRADING_MODEL_ID` comment so `gemini-*` notes Vertex AI (service account) instead of the Gemini API key.

**Checkpoint**: Dev/CI experience preserved offline; configuration docs accurate.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across the change.

- [X] T015 [P] Run `npm run lint` and `npm run format:check`; fix any issues introduced by the change.
- [X] T016 Run `npm test` with `FAKE_VENDORS=1`; confirm all unit tests pass and the suite makes zero network calls to Google Cloud (SC-005).
- [ ] T017 Operational verification on staging per `quickstart.md`: enable `aiplatform.googleapis.com`, grant `roles/aiplatform.user` to the OCR service account, submit an essay, confirm it reaches `completed`, the request is attributed to the project, and re-grading the same essay reproduces scores (SC-001, SC-002, SC-003). **⏸ PENDING — requires staging deploy + real GCP credentials; cannot be executed from the local dev environment. Owner: operator.**

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (Foundational)** must complete before any user story.
- **US1 (P1)** is the MVP; it depends only on Foundational.
- **US2 (P2)** depends on US1 (edits the same `llm.ts`); do US1 first, then US2 verification/hardening.
- **US3 (P3)** depends on Foundational (config/schema) and on `tests/unit/grading-provider.test.ts` existing (T004) for T013; otherwise independent of US1/US2 implementation.
- **Phase 6 (Polish)** runs after all stories.

```text
Setup ─▶ Foundational ─┬─▶ US1 ─▶ US2 ─┐
                       └─▶ US3 ─────────┴─▶ Polish
```

## Parallel Execution Examples

- **Foundational**: T002 (`src/lib/config.ts`) and T003 (`next.config.ts`) — different files, run together.
- **US3**: T012 (`env-config.test.ts`), T013 (`grading-provider.test.ts`), T014 (`.env.example`) — different files, run together (T013 requires T004's file to exist).
- **Polish**: T015 can run in parallel with staging prep for T017.

## Implementation Strategy

- **MVP = Phase 1 + Phase 2 + US1**: Gemini grading authenticated via Vertex AI on the service account. This alone delivers the migration's core value and is independently demonstrable.
- **Increment 2 = US2**: Lock in output-contract and determinism parity so the change is invisible to students.
- **Increment 3 = US3 + Polish**: Preserve offline dev/CI, update docs, and run the final lint/test/staging validation.
