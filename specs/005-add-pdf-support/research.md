# Phase 0 Research: PDF Support for Essay Submission

All Technical Context items are resolved from the existing codebase; there were no open
`NEEDS CLARIFICATION` markers after `/speckit-clarify`. This document records the decisions
that shape Phase 1.

## Decision 1 — Extract text from PDF via Google Vision `batchAnnotateFiles`

**Decision**: Extract PDF text with the Vision client's `batchAnnotateFiles` (synchronous
file annotation), mime type `application/pdf`, feature `DOCUMENT_TEXT_DETECTION`,
`languageHints: ["pt"]`. Use the same `ImageAnnotatorClient` and service-account
credentials already used for photo OCR. Read `totalPages` from the response to enforce the
single-page rule, and read page 1's `fullTextAnnotation` for text and per-word confidence.

**Rationale**:
- The current `documentTextDetection({ image: { content } })` accepts raster image bytes
  only; it does not accept PDF. `batchAnnotateFiles` is Vision's supported synchronous path
  for PDF/TIFF (up to 5 pages) and returns one response per page plus `totalPages`.
- Vision **rasterizes** the PDF page and OCRs it, so any embedded/selectable text layer is
  ignored — this is exactly the behavior clarified in FR-013 (one pipeline, one quality gate).
- Zero new runtime dependencies and no native binaries (aligns with Constitution II/IV). No
  PDF-rendering library (pdfjs/canvas/mupdf) and no system tools (Ghostscript/GraphicsMagick),
  which are awkward on a serverless runtime.
- `totalPages` gives an authoritative page count for the multi-page rejection (FR-011)
  without a second parsing library.
- The per-word `confidence` structure is identical to `documentTextDetection`, so the
  existing mean-confidence computation and 0.6 threshold apply unchanged.

**Alternatives considered**:
- **Render PDF → PNG locally, then reuse `documentTextDetection`** (pdfjs-dist + canvas,
  `pdf2pic`, or mupdf-wasm): adds a dependency and/or native/system requirement, more code,
  and a rendering-quality variable. Rejected on YAGNI/simplicity grounds — Vision already
  rasterizes internally.
- **Vision `asyncBatchAnnotateFiles` (writes JSON to GCS)**: designed for large/long PDFs;
  requires a GCS output bucket and polling. Overkill for a single-page essay. Rejected.
- **Use the PDF's embedded text layer when present**: rejected during `/speckit-clarify`
  (Session 2026-07-17) in favor of always-OCR for a uniform quality gate.

## Decision 2 — Enforce single page at extraction time

**Decision**: A PDF with `totalPages > 1` yields a new extraction outcome
`{ ok: false, reason: "multi_page_pdf" }`. `markUploaded` then marks the submission
`failed`, deletes the stored file, and releases any weekly-theme slot — the same handling as
other extraction failures. No credit is consumed because credit consumption only happens on
confirmation, which a failed submission never reaches (satisfies FR-011's "no credit").

**Rationale**: The page count is only known after opening the file; the earliest reliable,
cost-free (credit-wise) rejection point is the existing extraction step. This reuses the
established failure path rather than inventing a new pre-upload page-count parser (YAGNI).

**Alternatives considered**:
- **Parse page count locally before upload** (e.g., `pdf-lib.getPageCount()`): would reject
  a few milliseconds/one Vision call earlier but adds a dependency and a second code path for
  a rare case. Rejected — extraction-time rejection is simpler and already credit-safe.

## Decision 3 — Accepted content types and object-key suffix

**Decision**: Add `application/pdf` to the allowed upload types (`business.allowedImageTypes`,
used by `createSubmission`) and to the client `ALLOWED_TYPES`/`accept` attribute. Store the
file under `essays/{userId}/{id}.pdf` when the content type is PDF; `extractFromStorage`
selects image vs PDF extraction from the key suffix. No new persisted column — the type is
already implied by the key, and `contentType` is a transient input.

**Rationale**: Reuses the existing validation, size limit (10 MB), duplicate-by-SHA-256
detection, presigned-upload flow, and cleanup-on-failure. Inferring type from the key suffix
avoids a schema migration (Constitution II) and keeps extraction self-contained.

**Alternatives considered**:
- **Persist `contentType` on `Submission`**: unnecessary; the key suffix already encodes it.
  Rejected to avoid a migration.
- **Separate config list for PDF**: marginal benefit; extending the existing allowed-types
  list is simpler. (A rename of `allowedImageTypes` → `allowedUploadTypes` is an optional
  readability cleanup, noted in tasks, not required.)

## Decision 4 — User-facing failure messaging

**Decision**: Add a `multi_page_pdf` entry to `FAILURE_MESSAGES` (plain Portuguese: the file
has more than one page; send a single-page essay; no credit used). Unreadable/encrypted/
corrupt PDFs surface through the existing `extraction_failed` message ("Não conseguimos ler o
texto…"). This satisfies FR-009's requirement to distinguish "couldn't read the file" from
"not enough legible text" (`insufficient_text`) while adding the multi-page case.

**Rationale**: Reuses the existing reason→message map and the two existing distinctions,
adding only the one genuinely new case.

## Summary of resolved unknowns

| Item | Resolution |
|------|-----------|
| How to OCR a PDF with the current provider | Vision `batchAnnotateFiles`, sync, mime `application/pdf` |
| Ignore embedded text layer (FR-013) | Vision rasterizes → OCR only; inherent to the file-annotation path |
| Detect/reject multi-page (FR-011) | `totalPages > 1` → `multi_page_pdf` failure at extraction |
| New dependency needed? | No — reuse `@google-cloud/vision` + existing credentials |
| Schema/migration needed? | No — type inferred from object-key suffix |
| Size limit for PDF | Reuse existing 10 MB (`MAX_UPLOAD_BYTES`) |
