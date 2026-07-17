# Quickstart: PDF Support for Essay Submission

Bring up the app and exercise the PDF submission flow end to end.

## Prerequisites

- Existing local setup for Argos ENEM (see `specs/001-enem-essay-grading/stack.md`).
- `.env` configured, including `GOOGLE_APPLICATION_CREDENTIALS_JSON` (same service account
  used for OCR/grading) and `MAX_UPLOAD_BYTES` (default 10 MB).
- For deterministic runs without hitting Vision, set `FAKE_VENDORS=1` — the fake
  transcription provider returns canned text (and `totalPages: 1` by default).

## Run

```bash
npm run dev
# open http://localhost:3000 and sign in
```

## Manual test — happy path (single-page PDF)

1. Go to **Submissions → New**.
2. Confirm the file picker and helper text now offer **PDF** alongside JPEG/PNG.
3. Choose a **single-page PDF** of a legible handwritten essay (≤ 10 MB) and a theme.
4. Submit. Expect: upload → "extracting" → redirect to the **transcription review** screen
   with the extracted text.
5. Confirm the text. Expect: 1 credit consumed, grading starts, result appears — identical
   to the photo flow.

## Manual test — rejections (no credit consumed)

| Case | Input | Expected |
|------|-------|----------|
| Multi-page PDF | PDF with 2+ pages | Submission `failed`, message: "o PDF tem mais de uma página… envie um arquivo de uma página" — no credit used. |
| Unreadable/encrypted PDF | password-protected or corrupt PDF | `failed` with the "não conseguimos ler…" message — no credit used. |
| Blank / no essay | PDF with no legible text | `failed` (`extraction_failed` or `insufficient_text`) — no credit used. |
| Oversized | PDF > 10 MB | Rejected before upload with the size-limit message. |
| Duplicate | same PDF submitted twice | Second attempt shows the duplicate warning. |
| Wrong type | `.docx` / other | Rejected: "Formato não suportado…". |

After each failure, verify the uploaded object was deleted from R2 (FR-008) and the credit
balance is unchanged (FR-007).

## Automated tests

```bash
npm run test        # Vitest: submissions + transcription modules
npx playwright test # e2e: PDF happy path + multi-page rejection
```

Key coverage to add:
- `transcription`: `extractPdf` maps Vision `batchAnnotateFiles` → text + mean confidence;
  `totalPages > 1` → `multi_page_pdf`; extraction throw → `extraction_failed`.
- `submissions`: `application/pdf` accepted; `.pdf` key suffix; multi-page failure deletes
  file, releases weekly slot, consumes no credit.
- UI: file input accepts `application/pdf`; client-side type/size validation messages.
