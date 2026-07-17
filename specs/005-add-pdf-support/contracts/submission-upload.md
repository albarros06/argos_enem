# Contract: Essay Submission Upload (PDF-aware)

This feature extends the existing submission-upload endpoints to accept `application/pdf`.
Only the deltas from the current contract are described; unchanged behavior is noted as such.

## POST /api/submissions  — create submission + presigned upload URL

**Request body** (JSON) — unchanged shape; `contentType` gains a value:

| Field | Type | Change |
|-------|------|--------|
| `themeId` | uuid? | unchanged |
| `themeText` | string (1–500) | unchanged |
| `imageSha256` | string `[a-f0-9]{64}` | unchanged (hash of the PDF or photo) |
| `contentType` | string | **now accepts `application/pdf`** in addition to `image/jpeg`, `image/png` |
| `sizeBytes` | int > 0 | unchanged; must be `≤ 10 MB` for all types |
| `force` | boolean? | unchanged (bypass duplicate warning) |
| `weeklyThemeId` | uuid? | unchanged |

**Responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 200 | accepted | `{ submissionId, uploadUrl }` — `uploadUrl` presigned for the given `contentType`; object key is `essays/{userId}/{id}.pdf` for PDF |
| 400 | `contentType` not in {jpeg, png, pdf} | `{ error: { code: "VALIDATION_ERROR", message: "Formato não suportado. Envie uma foto JPEG, PNG ou um PDF." } }` |
| 400 | `sizeBytes` over limit | `{ error: { code: "VALIDATION_ERROR", message: "O arquivo excede o limite de 10 MB." } }` |
| 402 | insufficient credits | `{ error: { code: "INSUFFICIENT_CREDITS", ... } }` (unchanged) |
| 409 | duplicate `imageSha256` and not `force` | `{ error: { code: "DUPLICATE_IMAGE", ... } }` (unchanged) |

> Note: validation/error message wording updates from "foto JPEG ou PNG" to include PDF.

## PUT {uploadUrl}  — client uploads the file to R2

Unchanged. Client PUTs the raw file bytes with `Content-Type` equal to the `contentType`
sent above (`application/pdf` for PDFs).

## POST /api/submissions/{id}/uploaded  — run extraction (OCR)

**Behavior delta**: extraction routes on the stored object-key suffix.

- Photo (`.jpg`/`.png`): `documentTextDetection` (unchanged).
- PDF (`.pdf`): `batchAnnotateFiles` (mime `application/pdf`).
  - If `totalPages > 1` → submission `failed`, `failureReason = "multi_page_pdf"`, file
    deleted, weekly slot released, **no credit consumed**.
  - Else evaluate page 1 text against the same quality gate (non-empty, mean confidence
    ≥ 0.6, ≥ 7 lines) → `awaiting_review` on success, or `extraction_failed` /
    `insufficient_text` on failure (unchanged semantics).

**Responses** (shape unchanged): `{ status, failureReason }`.

| `status` | `failureReason` | Meaning |
|----------|-----------------|---------|
| `awaiting_review` | null | Text extracted; proceed to review. |
| `failed` | `multi_page_pdf` | **NEW** — PDF had more than one page. |
| `failed` | `extraction_failed` | File unreadable/encrypted/corrupt, or low OCR confidence. |
| `failed` | `insufficient_text` | Fewer than the minimum lines. |

## Unchanged endpoints

`/confirm`, `/abandon`, result view, and listing are unaffected — a PDF-sourced submission
behaves identically to a photo-sourced one from `awaiting_review` onward.
