<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the active plan:

**Current Feature**: `specs/005-add-pdf-support/plan.md` (accept single-page PDF essays in the
pre-OCR step, alongside JPEG/PNG — PDF text extracted via Google Vision `batchAnnotateFiles`
which rasterizes+OCRs the page and reports `totalPages`; multi-page PDFs rejected
(`multi_page_pdf`), embedded text layer ignored, existing 10 MB limit / dedup / quality gate
reused, no new dependency and no DB migration; contract in `contracts/submission-upload.md`,
types in `data-model.md`, setup in `quickstart.md`).

**Previous Context**: `specs/004-vertex-ai-migration/plan.md` (Gemini grading via Vertex AI —
service-account auth, region `us-central1`). `specs/003-design-system-ui/plan.md` (design
system UI — tokens, theme switching). Base stack: `specs/002-redacoes-semana/plan.md` and
`specs/001-enem-essay-grading/stack.md`; API in `contracts/api.md`.

Project principles: `.specify/memory/constitution.md`.

<!-- SPECKIT END -->
