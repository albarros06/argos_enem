---
description: "Task list for PDF Support for Essay Submission"
---

# Tasks: PDF Support for Essay Submission

**Input**: Design documents from `/specs/005-add-pdf-support/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/submission-upload.md

**Tests**: INCLUDED — the project constitution (Restrições e Padrões de Qualidade) requires
new functionality to ship with tests covering the affected module's public behavior. Tests
use Vitest (`tests/unit`, `tests/integration`) and Playwright (`tests/e2e`), with vendor
calls faked via `FAKE_VENDORS`.

**Organization**: Tasks are grouped by user story (P1 → P3) for independent implementation
and testing. MVP = User Story 1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, Polish have no story label)

## Path Conventions

Single Next.js web app. Source under `src/` (`src/app`, `src/modules`, `src/lib`), tests
under `tests/` (`unit`, `integration`, `e2e`, `fixtures`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test fixtures needed by every downstream test.

- [X] T001 [P] Sample single-page PDF — DEVIATION: with `FAKE_VENDORS` the OCR ignores file content, so an inline minimal PDF buffer (`PDF_1PAGE` in `tests/e2e/pdf-submission.spec.ts`) is used instead of a committed binary fixture
- [X] T002 [P] Two-page PDF case — DEVIATION: multi-page is driven by the fake provider's `totalPages` (`enqueueFakePdfResult({ totalPages: 2 })` in `tests/integration/submissions.test.ts` / `tests/unit/transcription-pdf.test.ts`), so no binary fixture is needed

**Checkpoint**: Fixtures available for module and e2e tests.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared plumbing that all user stories compile and depend on — accepted upload
types, the PDF extraction provider method, and its fake counterpart. **No user story work can
begin until this phase is complete.**

- [X] T003 Add `application/pdf` to the accepted upload types in `src/lib/config.ts` (extend `allowedImageTypes`)
- [X] T004 Extend the `TranscriptionProvider` interface with `extractPdf(pdf: Buffer)` and add a `PdfTranscriptionResult` type (`text`, `meanConfidence`, `totalPages`) in `src/modules/transcription/provider.ts`
- [X] T005 Implement Vision `extractPdf` via `batchAnnotateFiles` (mime `application/pdf`, `DOCUMENT_TEXT_DETECTION`, `languageHints: ["pt"]`) — read page-1 `fullTextAnnotation` for text + mean word confidence, and `totalPages` — in `src/modules/transcription/provider.ts` (depends on T004)
- [X] T006 Implement `FakeTranscriptionProvider.extractPdf` returning a deterministic result and honoring the fake queue (support canned text, configurable `totalPages`, and thrown errors) in `src/modules/transcription/provider.ts` (depends on T004)

**Checkpoint**: Providers compile; PDF text can be extracted behind the provider interface.

---

## Phase 3: User Story 1 - Submit an essay as a PDF (Priority: P1) 🎯 MVP

**Goal**: A student can submit a legible single-page PDF and reach the transcription-review
step, exactly like a photo submission.

**Independent Test**: Submit `essay-1page.pdf` with `FAKE_VENDORS=1`; the submission advances
to `awaiting_review` with extracted text shown for review.

### Tests for User Story 1

- [X] T007 [P] [US1] Integration test: `createSubmission` accepts `contentType: "application/pdf"`, stores an `essays/{userId}/{id}.pdf` key, and returns a presigned upload URL — in `tests/integration/submissions.test.ts`
- [X] T008 [P] [US1] Integration test: `markUploaded` on a `.pdf` key routes to `extractPdf` and transitions a single-page PDF to `awaiting_review` with a transcription — in `tests/integration/submissions.test.ts`
- [X] T009 [P] [US1] E2E test authored: new-submission flow with a single-page PDF reaches the review screen — in `tests/e2e/pdf-submission.spec.ts` (not executed here — needs a running dev server + browser)

### Implementation for User Story 1

- [X] T010 [US1] In `createSubmission`, accept `application/pdf`, choose the `.pdf` object-key suffix for PDFs, and update the unsupported-format message to include PDF — in `src/modules/submissions/index.ts`
- [X] T011 [US1] Route `extractFromStorage` by object-key suffix: `.pdf` → provider `extractPdf` (apply the same non-empty / mean-confidence ≥ 0.6 / ≥ 7-line quality gate to the extracted text); images unchanged — in `src/modules/transcription/index.ts`
- [X] T012 [US1] Update `NewSubmissionForm` to accept PDF: add `application/pdf` to `ALLOWED_TYPES`, the file `accept` attribute, the label/help text ("JPEG, PNG ou PDF"), and the client-side unsupported-format message — in `src/app/(app)/submissions/new/NewSubmissionForm.tsx`

**Checkpoint**: Single-page PDF submission works end to end and is independently testable (MVP).

---

## Phase 4: User Story 2 - Clear handling when a PDF cannot be processed (Priority: P2)

**Goal**: PDFs that cannot become usable essay text (multi-page, encrypted/corrupt, blank)
fail with a plain-language message, consume no credit, and have their file deleted.

**Independent Test**: Submit `essay-2page.pdf` → submission `failed` with `multi_page_pdf`,
no credit consumed, file removed; submit a corrupt PDF → `extraction_failed`, no credit.

### Tests for User Story 2

- [X] T013 [P] [US2] Integration test: multi-page PDF → status `failed`, `failureReason = "multi_page_pdf"`, no credit consumed, stored file deleted, weekly-theme slot released — in `tests/integration/submissions.test.ts`
- [X] T014 [P] [US2] Unit test: `extractFromStorage` maps `extractPdf` throw → `extraction_failed` and `totalPages > 1` → `multi_page_pdf` — in `tests/unit/transcription-pdf.test.ts`

### Implementation for User Story 2

- [X] T015 [US2] Add `"multi_page_pdf"` to the `ExtractionOutcome` failure union in `src/modules/transcription/index.ts`
- [X] T016 [US2] In `extractFromStorage` PDF branch, return `{ ok: false, reason: "multi_page_pdf" }` when `totalPages > 1` (before the quality gate); keep Vision throws mapped to `extraction_failed` — in `src/modules/transcription/index.ts` (depends on T015)
- [X] T017 [US2] Add a `multi_page_pdf` entry to `FAILURE_MESSAGES` (plain pt-BR: more than one page, send a single-page essay file, no credit used) in `src/app/(app)/submissions/[id]/page.tsx`

**Checkpoint**: PDF failure paths are user-clear and credit-safe; US1 still works.

---

## Phase 5: User Story 3 - Consistent limits and duplicate protection for PDFs (Priority: P3)

**Goal**: PDFs obey the same 10 MB size limit and duplicate-file protection as photos, with
message wording that fits either file type.

**Independent Test**: Submit a > 10 MB PDF → rejected before upload with the size message;
submit the same PDF twice → duplicate warning on the second attempt.

### Tests for User Story 3

- [X] T018 [P] [US3] Integration test: oversized PDF (`sizeBytes > MAX_UPLOAD_BYTES`) is rejected with `VALIDATION_ERROR`, and a duplicate PDF (same `imageSha256`, no `force`) returns `DUPLICATE_IMAGE` — in `tests/integration/submissions.test.ts`

### Implementation for User Story 3

- [X] T019 [US3] Generalize the size-limit and duplicate wording in `NewSubmissionForm` to fit PDFs as well as photos ("arquivo"/"a foto ou o PDF") in `src/app/(app)/submissions/new/NewSubmissionForm.tsx`
- [X] T020 [US3] Generalize the oversized-file message in `createSubmission` to read "arquivo" instead of "imagem" in `src/modules/submissions/index.ts`

**Checkpoint**: All three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, verification, and quality gates across the feature.

- [X] T021 [P] Optional readability cleanup: rename `allowedImageTypes` → `allowedUploadTypes` across `src/lib/config.ts` and callers (constitution I) — skip if it widens the diff unhelpfully
- [X] T022 [P] Sweep remaining "foto"/"imagem"-only copy in the submission and review screens for accuracy with PDFs in `src/app/(app)/submissions/`
- [X] T023 Run `npm run lint` and `npm run format`/Prettier; fix any issues
- [X] T024 Run `npm run test` (Vitest) — 142 passed. `npm run test:e2e` (Playwright) NOT run here (needs dev server + browsers)
- [ ] T025 Execute the `specs/005-add-pdf-support/quickstart.md` manual checklist (happy path + each rejection) — PENDING: requires a running app; automated unit+integration tests already cover the equivalent behavior (credit-safe failures, file deletion, multi-page rejection)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational.
  - US1 (P1) has no dependency on US2/US3.
  - US2 (P2) is independently testable; it edits the same extraction file US1 touched, so run its extraction tasks after US1's T011 to avoid churn (soft ordering, not a hard block).
  - US3 (P3) is fully independent of US1/US2.
- **Polish (Phase 6)**: After the desired stories are complete.

### Within Each User Story

- Tests written first and expected to FAIL before implementation.
- Provider/type changes before the code that consumes them.
- Core implementation before message/UI wording.

### Parallel Opportunities

- Setup: T001, T002 in parallel.
- Foundational: T004 must precede T005/T006 (same file, dependency); T003 is independent and can run in parallel with T004.
- US1 tests T007, T008, T009 in parallel (T007/T008 share a file but are additive; T009 is a separate file — safe to author together).
- US2 tests T013, T014 in parallel (different files).
- Cross-story: once Foundational is done, US1 and US3 can be built in parallel by different developers; US2 shares files with US1.
- Polish: T021, T022 in parallel.

---

## Parallel Example: User Story 1

```bash
# Author US1 tests together:
Task: "Integration test: createSubmission accepts application/pdf in tests/integration/submissions.test.ts"
Task: "Integration test: markUploaded routes .pdf to extractPdf in tests/integration/submissions.test.ts"
Task: "E2E: single-page PDF reaches review screen in tests/e2e/pdf-submission.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (fixtures).
2. Phase 2: Foundational (config + provider `extractPdf` + fake).
3. Phase 3: User Story 1 (accept PDF, route extraction, form).
4. **STOP and VALIDATE**: submit a single-page PDF end to end.
5. Deploy/demo — students can already submit PDFs.

### Incremental Delivery

1. Setup + Foundational → plumbing ready.
2. US1 → single-page PDF submission (MVP) → demo.
3. US2 → robust failure handling (multi-page/encrypted/blank) → demo.
4. US3 → limit/dedup wording parity → demo.

### Parallel Team Strategy

After Foundational: Developer A on US1, Developer C on US3 in parallel; US2 follows US1 (shared files).

---

## Notes

- [P] = different files, no incomplete dependencies.
- `extractFromStorage` (`src/modules/transcription/index.ts`) is edited in both US1 (T011) and
  US2 (T015–T016) — keep those sequential.
- `NewSubmissionForm.tsx` and `createSubmission` are each touched by multiple stories — not [P]
  across those tasks.
- Credit safety comes for free on failure: credits are only consumed at confirmation, which a
  `failed` submission never reaches — assert this explicitly in T013.
- Commit after each task or logical group; verify tests fail before implementing.
