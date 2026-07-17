# Implementation Plan: PDF Support for Essay Submission

**Branch**: `005-add-pdf-support` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-add-pdf-support/spec.md`

## Summary

Allow students to submit an essay as a single-page PDF, in addition to JPEG/PNG photos,
in the step that precedes OCR. An accepted PDF flows through the existing pipeline
(validate → presigned upload to R2 → extract text → transcription review → confirm →
grade). The only new external behavior is text extraction from PDF: the current Google
Vision `documentTextDetection` call accepts raster images only, so PDF extraction uses
Vision's `batchAnnotateFiles` (synchronous file annotation), which rasterizes and OCRs the
page — ignoring any embedded text layer — and reports the page count so multi-page PDFs can
be rejected. No new runtime dependency and no new external service: the same
`@google-cloud/vision` client and service-account credentials are reused. The only schema
change is one added `FailureReason` enum value (`multi_page_pdf`) via a small migration.

## Technical Context

**Language/Version**: TypeScript 6.x, Node (Next.js 15 App Router), React 19

**Primary Dependencies**: Next.js 15, Prisma 6 (PostgreSQL/Supabase), `@google-cloud/vision`
5.x (OCR), `@aws-sdk/client-s3` (Cloudflare R2 storage), Zod 4 (validation). No new
dependency introduced by this feature.

**Storage**: PostgreSQL via Prisma (submissions/transcriptions); Cloudflare R2 for the
uploaded essay file. The file type is encoded in the object-key suffix (no new column); the
only schema change is the added `FailureReason` enum value `multi_page_pdf`.

**Testing**: Vitest (unit/module), Playwright (e2e). Fake vendor providers gated by
`FAKE_VENDORS` for deterministic tests.

**Target Platform**: Server-rendered web app (Next.js) on Linux/serverless runtime.

**Project Type**: Web application (single Next.js project; `src/app` UI + `src/modules`
domain modules).

**Performance Goals**: PDF extraction latency comparable to photo OCR (single synchronous
Vision call, one page). No regression to the existing photo flow.

**Constraints**: Reuse the existing 10 MB upload limit, duplicate-by-hash detection,
OCR confidence threshold (0.6) and minimum-line threshold (7). Extraction failure must not
consume a credit (credit is only consumed on confirmation, which a failed submission never
reaches). Single page per submission.

**Scale/Scope**: Small, additive change touching the submission-create validation, the
transcription provider/extraction module, the failure-message map, and the upload form.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| I. Código Legível Primeiro | PASS — small, intention-revealing additions (`extractPdf`, a `multi_page_pdf` reason). No clever constructs; functions stay well under the ~40-line reference. |
| II. Estrutura Simples (YAGNI) | PASS — reuses the existing pipeline, client, credentials, limits, and storage. Zero new dependencies; no PDF-rendering library or system binary. Multi-page is rejected rather than building multi-page assembly. |
| III. Modularidade Obrigatória | PASS — PDF extraction lives behind the existing `TranscriptionProvider` interface; the submissions module calls it without knowing Vision specifics. Boundaries and unidirectional dependencies preserved. |
| IV. Manutenibilidade | PASS — one extraction pipeline and one quality gate serve both photo and PDF (FR-013), minimizing branching. New behavior is unit-testable via the fake provider. |
| V. Preparado para Escala | PASS — extraction stays isolated behind the provider interface (cacheable/queueable later); no shared mutable state added; business logic stays out of I/O. |

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/005-add-pdf-support/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── submission-upload.md
└── checklists/
    └── requirements.md  # Spec quality checklist (from /speckit-specify)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── (app)/submissions/
│       ├── new/NewSubmissionForm.tsx      # accept application/pdf: file input, validation, labels
│       └── [id]/page.tsx                    # add failure message for multi_page_pdf
├── modules/
│   ├── submissions/index.ts                 # accept PDF content type; key suffix .pdf
│   └── transcription/
│       ├── index.ts                         # extractFromStorage branches image vs PDF; multi_page_pdf reason
│       └── provider.ts                      # add extractPdf() to Vision + Fake providers
└── lib/
    └── config.ts                            # allowed upload types include application/pdf

tests/                                       # Vitest module tests + Playwright e2e (mirror existing layout)
```

**Structure Decision**: Single Next.js web application. The change is confined to the
submissions and transcription modules plus the upload form and failure-message map. No new
directories or projects; existing module boundaries are respected.

## Complexity Tracking

> No Constitution Check violations — this section intentionally left empty.
