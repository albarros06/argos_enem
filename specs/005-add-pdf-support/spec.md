# Feature Specification: PDF Support for Essay Submission

**Feature Branch**: `005-add-pdf-support`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "The step before sending the essay to the OCR API must include PDF support"

## Clarifications

### Session 2026-07-17

- Q: How should the system handle a PDF that contains more than one page? → A: Reject multi-page PDFs before extraction with a clear message asking for a single-page file (no credit consumed).
- Q: How should extraction treat a PDF that carries a selectable digital text layer (not a scan)? → A: Always render the page and run OCR; ignore any embedded text layer (single pipeline, uniform quality gate).
- Q: What upload size limit should apply to PDF essays? → A: Reuse the existing 10 MB upload limit, same as photos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit an essay as a PDF (Priority: P1)

A student has their handwritten essay as a PDF file (for example, a scan produced by a
copier or a "scan to PDF" phone app) instead of a photo. They start a new submission,
choose the PDF file, and the system accepts it and extracts the essay text just as it
does today for photos, so the student can review the transcription and continue to
grading.

**Why this priority**: This is the entire purpose of the feature. Many students already
receive or produce their essays as PDF scans, and today the submission form rejects them,
forcing the student to convert the file manually. Accepting PDFs directly removes that
friction and is the minimum viable slice — everything else is refinement.

**Independent Test**: Can be fully tested by submitting a single-page PDF containing a
legible handwritten essay and verifying that text extraction succeeds and the student
reaches the transcription review step, delivering the same outcome as a photo submission.

**Acceptance Scenarios**:

1. **Given** a student on the new-submission screen with enough credits, **When** they select a valid single-page PDF of their essay and complete the upload, **Then** the system extracts the essay text and advances the submission to the transcription-review step.
2. **Given** a student who selected a PDF, **When** the submission form shows accepted formats, **Then** PDF is presented as an allowed option alongside the existing photo formats.
3. **Given** a submitted PDF that yields readable text above the quality threshold, **When** extraction completes, **Then** the student sees the extracted text to review and confirm, identical to the photo flow.

---

### User Story 2 - Clear handling when a PDF cannot be processed (Priority: P2)

A student uploads a PDF that the system cannot turn into usable essay text — it is
password-protected, corrupted, an unexpected type disguised as PDF, or contains no
legible essay. The system tells the student what went wrong in plain language and does
not charge a credit, so they can fix the file and try again.

**Why this priority**: PDFs fail in more ways than photos (encryption, multiple/blank
pages, non-essay content). Without clear, non-charging failure handling, students lose
credits or get stuck. This protects trust but depends on the P1 happy path existing first.

**Independent Test**: Can be tested by submitting a password-protected or corrupted PDF
and verifying the submission fails with an understandable message, no credit is consumed,
and the stored file is removed.

**Acceptance Scenarios**:

1. **Given** a student uploads a password-protected or unreadable PDF, **When** the system attempts extraction, **Then** the submission is marked failed with a clear message and no credit is consumed.
2. **Given** a PDF whose extracted text falls below the quality or minimum-length threshold, **When** extraction completes, **Then** the same failure handling used for low-quality photos applies (fail, no credit consumed).
3. **Given** any failed PDF submission, **When** the failure is recorded, **Then** the uploaded file is deleted from storage.

---

### User Story 3 - Consistent limits and duplicate protection for PDFs (Priority: P3)

A student submitting a PDF is held to the same size limit and duplicate-file protection
as a photo submission, so the feature does not open a loophole around existing safeguards.

**Why this priority**: Reuses existing guardrails rather than inventing new behavior. It
matters for cost and fairness but is not required to prove the core capability works.

**Independent Test**: Can be tested by submitting a PDF over the size limit (rejected) and
by submitting the same PDF twice (second attempt flagged as a duplicate).

**Acceptance Scenarios**:

1. **Given** a PDF larger than the allowed upload size, **When** the student tries to submit it, **Then** the system rejects it with a size-limit message before processing.
2. **Given** a student who already submitted a specific PDF file, **When** they submit the identical file again, **Then** the system flags it as a likely duplicate, consistent with photo behavior.

---

### Edge Cases

- **Multi-page PDF**: A PDF contains more than one page. The system rejects it before
  extraction with a clear message asking the student to submit a single-page essay file;
  no credit is consumed.
- **PDF with embedded/selectable text vs. scanned image**: A PDF may be a scan (image of
  handwriting) or contain a digital text layer. In both cases the page is rendered and run
  through OCR (the embedded text layer is not used), and the student reviews and confirms
  the resulting text before grading.
- **Empty, blank, or non-essay PDF**: Extraction yields no usable text → handled by the
  standard "insufficient text / extraction failed" path (fail, no credit).
- **Encrypted or corrupted PDF**: Cannot be opened/processed → clear failure message, no
  credit consumed, file deleted.
- **File claims to be PDF but is not** (wrong or spoofed type): Rejected or failed with an
  understandable message, no credit consumed.
- **More than one page**: Any PDF with more than a single page is rejected before
  processing (see multi-page handling above), independent of the size limit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept PDF files as a valid essay input format in the submission step that precedes text extraction (OCR), in addition to the currently supported photo formats.
- **FR-002**: System MUST present PDF as an allowed format to the student on the submission interface (accepted-formats hint and file picker) alongside the existing photo formats.
- **FR-003**: System MUST convert or route an accepted PDF so that its essay content is turned into text by the same extraction step used for photos, producing the same reviewable transcription output.
- **FR-004**: System MUST apply the same maximum upload size limit to PDF submissions as to photo submissions and reject oversized PDFs before extraction, with a clear size-limit message.
- **FR-005**: System MUST apply the same duplicate-file protection to PDF submissions as to photo submissions, flagging a re-submission of the identical file.
- **FR-006**: System MUST apply the existing text-quality and minimum-length thresholds to text extracted from a PDF, using the same accept/fail criteria as photos.
- **FR-007**: System MUST NOT consume a credit when PDF extraction fails for any reason (unreadable, encrypted, insufficient or low-quality text).
- **FR-008**: System MUST delete the stored PDF file when the submission fails, consistent with existing photo cleanup behavior.
- **FR-009**: System MUST provide the student with an understandable, plain-language message when a PDF cannot be processed, distinguishing at least "file could not be read/opened" from "not enough legible essay text".
- **FR-010**: System MUST reject files that are not one of the supported formats (still rejecting anything other than the supported photo formats and PDF) with a clear unsupported-format message.
- **FR-011**: System MUST reject a PDF that contains more than one page before extraction, with a clear message asking the student to submit a single-page essay file, and MUST NOT consume a credit for such a rejection.
- **FR-012**: System MUST preserve the existing transcription-review step for PDF submissions, allowing the student to correct extraction errors before confirming and consuming a credit.
- **FR-013**: System MUST extract essay text from a PDF by rendering its single page and running the same OCR step used for photos, ignoring any embedded/selectable text layer, so that one extraction pipeline and one quality gate serve both photo and PDF submissions.

### Key Entities *(include if data involved)*

- **Essay Submission**: A student's attempt to have one essay graded. Gains the ability to
  originate from a PDF file in addition to a photo. Retains its existing attributes
  (owner, theme, uploaded-file reference, content hash for duplicate detection, status,
  failure reason).
- **Uploaded Essay File**: The source artifact the student provides. Its accepted set of
  types expands to include PDF. Still subject to size limits, duplicate detection by
  content, and deletion on failure or after confirmation.
- **Transcription**: The extracted essay text plus a confidence measure. Now may originate
  from a PDF source; downstream review, confirmation, and grading are unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student can submit a legible single-page PDF essay and reach the transcription-review step without converting the file to an image first.
- **SC-002**: 100% of PDF submissions that fail extraction result in zero credits consumed.
- **SC-003**: For legible single-page PDF scans of comparable quality to accepted photos, extraction success rate is at least on par with the existing photo flow (no regression in the share that reach transcription review).
- **SC-004**: 100% of failed PDF submissions have their uploaded file removed from storage.
- **SC-005**: Every PDF rejection or failure returns a message a non-technical student can act on (identifying whether to shrink the file, unlock/replace it, or improve legibility).
- **SC-006**: The existing photo-submission flow continues to work unchanged, with no regression in acceptance or extraction behavior.

## Assumptions

- **Scope is the input/pre-extraction step only**: The feature adds PDF as an accepted input
  and ensures its content reaches the existing extraction step. Grading, review, credits,
  and weekly-theme rules are unchanged.
- **Single-page essays only**: An ENEM essay is a single page, so an accepted PDF must
  contain exactly one page. Multi-page PDFs are rejected with a clear message rather than
  processed, keeping extraction unambiguous and cost bounded at one page per submission.
- **PDF treated as an image source**: A PDF's page is always rendered and passed through the
  same OCR step as a photo; any embedded digital text layer is ignored. One pipeline and one
  quality gate serve both photo and PDF submissions.
- **Same limits reused**: PDF submissions reuse the existing maximum upload size (10 MB),
  duplicate detection, quality/length thresholds, and file-cleanup behavior rather than
  introducing new PDF-specific limits.
- **Existing storage and extraction pipeline are reused**: The current file-upload and
  text-extraction pipeline is extended to handle PDF; no new external service is assumed
  beyond what already performs extraction, and any PDF-to-image conversion needed for
  extraction is treated as an internal implementation detail.
- **Single file per submission**: A submission continues to carry exactly one source file
  (one PDF or one photo), not a mix.
- **Non-technical students**: The primary users are students who may not know terms like
  "OCR" or "encryption"; messaging must remain in plain language.
