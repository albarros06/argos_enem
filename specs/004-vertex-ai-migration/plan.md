# Implementation Plan: Migrate Gemini Grading Provider to Vertex AI

**Branch**: `004-vertex-ai-migration` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-vertex-ai-migration/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Move Gemini-model essay grading off the Gemini Developer API (API-key auth) and onto **Vertex AI**, authenticated by the Google Cloud service account already used for OCR (`GOOGLE_APPLICATION_CREDENTIALS_JSON`). The change is confined to the grading module's Gemini provider: it switches `GoogleGenAI` from API-key mode to Vertex mode (`vertexai: true`, project derived from the credential, region defaulting to `us-central1`). The grading prompt, rubric, controlled-output JSON schema, determinism (temperature 0), and returned evaluation contract are all preserved, so the change is invisible to students. The legacy `GEMINI_API_KEY` path is removed; local dev and CI continue to use the deterministic fake provider or the Claude path.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS (same as base project)

**Primary Dependencies**: `@google/genai ^2.11.0` (already installed — switched from API-key to Vertex mode); `google-auth-library` (transitive, drives service-account auth); Next.js 15 App Router; Zod 4 for output validation. No new dependency is added.

**Storage**: N/A — no database or schema changes. The `Evaluation.modelId` column continues to store `business.gradingModelId` unchanged.

**Testing**: Vitest (unit). Grading in tests/E2E runs through the deterministic `FakeGradingProvider` gated by `FAKE_VENDORS=1` — no external calls. Env-config tests validate credential shape.

**Target Platform**: Linux server (Vercel deployment); Google Cloud Vertex AI in region `us-central1`.

**Project Type**: Web application (Next.js server-side module). This feature touches only server-side grading code.

**Performance Goals**: No regression in grading turnaround beyond normal variance (SC-003). Determinism preserved (temperature 0, reproducible scores — SC-002).

**Constraints**:
- Constitution II (Estrutura Simples): reuse the existing credential and existing SDK; derive project from the credential instead of adding required config; no new provider abstraction.
- Preserve the `GradingProvider` interface and `LlmEvaluation` contract exactly (FR-004).
- Configuration (project, region) lives outside source in env vars (constitution "Configuração fora do código").
- Fail loudly on misconfiguration (FR-008); no silent fallback to the removed API-key path.

**Scale/Scope**:
- 1 provider class rewritten (`GeminiGradingProvider` in `src/modules/grading/llm.ts`).
- Config surface: remove `GEMINI_API_KEY`; add `GOOGLE_CLOUD_LOCATION` (default `us-central1`) and optional `GOOGLE_CLOUD_PROJECT` (default: derive from credential `project_id`).
- Docs: `.env.example` + quickstart updated.
- 0 new database models, 0 new external services, 0 UI changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Código Legível Primeiro** | ✅ PASS | The Vertex construction is a small, self-describing change to one provider constructor; option names (`vertexai`, `project`, `location`) reveal intent. No cryptic constructs. |
| **II. Estrutura Simples** | ✅ PASS | Reuses the already-installed `@google/genai` SDK and the existing service-account secret; derives the project from the credential rather than adding a required env var. No new abstraction layer, no new dependency, no speculative config. |
| **III. Modularidade Obrigatória** | ✅ PASS | Change is fully contained in the grading module's `llm.ts`; the public `GradingProvider` interface and `LlmEvaluation` schema are unchanged, so no other module is affected. Auth pattern mirrors the transcription module (single-responsibility provider). |
| **IV. Manutenibilidade como Prioridade** | ✅ PASS | Consolidates grading + OCR onto one credential and one billing/governance surface, reducing secrets to maintain. Removing the dead API-key path lowers surface area. Behavior is covered by existing schema/fake tests plus new provider-selection tests. |
| **V. Preparado para Escala** | ✅ PASS | Provider stays stateless behind the `GradingProvider` interface; the LLM call remains isolated (allowing future caching/queueing). Regional endpoint choice is config-driven, not hardcoded into logic. |

**Initial gate: PASS** — no violations, no Complexity Tracking entries required. **Post-design re-check: PASS** (see end of Phase 1).

## Project Structure

### Documentation (this feature)

```text
specs/004-vertex-ai-migration/
├── plan.md              # This file (/speckit-plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── grading-provider.md  # Provider + configuration contract
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── config.ts                    # env schema: remove GEMINI_API_KEY;
│                                    #   add GOOGLE_CLOUD_LOCATION, GOOGLE_CLOUD_PROJECT
└── modules/
    └── grading/
        └── llm.ts                   # GeminiGradingProvider → Vertex mode

next.config.ts                       # add @google/genai to serverExternalPackages (if bundling requires)
.env.example                         # document Vertex vars; drop GEMINI_API_KEY

tests/
└── unit/
    ├── env-config.test.ts           # update: drop GEMINI_API_KEY assumptions; add location default
    └── grading-provider.test.ts     # NEW: provider selection + Vertex config wiring
```

**Structure Decision**: Single-project Next.js layout (unchanged). The change is localized to `src/modules/grading/llm.ts` and `src/lib/config.ts`, mirroring the existing OCR provider pattern in `src/modules/transcription/provider.ts`. No new directories.

## Complexity Tracking

> No Constitution Check violations. No entries required.
