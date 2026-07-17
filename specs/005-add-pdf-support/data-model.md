# Phase 1 Data Model: PDF Support for Essay Submission

**One small migration is required** (correcting the initial plan assumption): `failureReason`
is a Prisma `enum FailureReason`, so the new value `multi_page_pdf` must be added to it. No
table/column changes otherwise — the feature reuses the existing `Submission` and
`Transcription` models. Migration: `prisma/migrations/*_add_multi_page_pdf_failure_reason/`
(`ALTER TYPE "FailureReason" ADD VALUE 'multi_page_pdf' BEFORE 'grading_failed';`). The
document below records the conceptual model and the in-code types that change.

## Entities (existing — unchanged schema)

### Submission

| Field | Type | Notes for this feature |
|-------|------|------------------------|
| `id` | UUID | Unchanged. |
| `imageKey` | string \| null | Now may end in `.pdf` (`essays/{userId}/{id}.pdf`) in addition to `.jpg`/`.png`. The suffix is the source of truth for extraction routing. Cleared to `null` on failure/confirm/abandon as today. |
| `imageSha256` | string (64 hex) | Content hash of the uploaded file (photo or PDF); powers duplicate detection for PDFs unchanged. |
| `status` | enum | Unchanged lifecycle: `pending → awaiting_review → grading → completed`, or `failed`/`expired`. |
| `failureReason` | string \| null | May now hold the new value `multi_page_pdf` (plus existing `extraction_failed`, `insufficient_text`, `grading_failed`). |

> `contentType` is a transient input to `createSubmission` (validated, used to pick the key
> suffix and the presigned-upload content type). It is **not** persisted — no column added.

### Transcription

Unchanged. Populated from extracted text + mean confidence whether the source was a photo or
a PDF. Review/confirm/grade flow is identical.

## Validation rules (from requirements)

- **Accepted upload types** (FR-001, FR-010): `image/jpeg`, `image/png`, `application/pdf`.
  Anything else → `VALIDATION_ERROR` "Formato não suportado…".
- **Size limit** (FR-004): `sizeBytes ≤ MAX_UPLOAD_BYTES` (10 MB) for all types.
- **Duplicate detection** (FR-005): reject a non-`force` submission whose `imageSha256`
  matches a prior non-failed/non-expired submission for the same user.
- **Single page** (FR-011): a PDF whose `totalPages > 1` fails extraction with
  `multi_page_pdf`; no credit consumed.
- **Quality gate** (FR-006): extracted text must be non-empty, `meanConfidence ≥ 0.6`, and
  `essayLines ≥ 7`; otherwise `extraction_failed` / `insufficient_text` as today.

## Changed in-code types

### `ExtractionOutcome` (`src/modules/transcription/index.ts`)

```text
| { ok: true;  rawText: string; meanConfidence: number }
| { ok: false; reason: "extraction_failed" | "insufficient_text" | "multi_page_pdf" }
```

`multi_page_pdf` is the only added variant.

### `TranscriptionProvider` (`src/modules/transcription/provider.ts`)

```text
interface TranscriptionProvider {
  extract(image: Buffer): Promise<TranscriptionResult>;          // images (existing)
  extractPdf(pdf: Buffer): Promise<PdfTranscriptionResult>;      // NEW: PDF via batchAnnotateFiles
}

// PdfTranscriptionResult = TranscriptionResult & { totalPages: number }
```

The Vision implementation calls `batchAnnotateFiles`; the Fake implementation returns a
queued/deterministic result (default `totalPages: 1`) so tests can exercise both the
happy path and the multi-page rejection.

## Failure-reason → message map (`src/app/(app)/submissions/[id]/page.tsx`)

| Reason | User-facing message (pt-BR, summarized) |
|--------|------------------------------------------|
| `extraction_failed` | Couldn't read the file/photo; resend with better legibility; no credit used. (existing) |
| `insufficient_text` | Text too short (min 7 lines); resend the full essay; no credit used. (existing) |
| `multi_page_pdf` | **NEW** — The PDF has more than one page; send a single-page essay file; no credit used. |
| `grading_failed` | Grading failed; credit refunded. (existing) |
