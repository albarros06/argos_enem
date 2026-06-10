# Implementation Plan: Argos — ENEM Essay Grading Platform

**Branch**: `001-enem-essay-grading` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-enem-essay-grading/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Argos is a web application where students upload photos of handwritten ENEM essays,
review and correct the OCR transcription, and receive an AI evaluation strictly aligned
with the 5 official ENEM competencies (total 0–1000, per-competency 0–200 in 40-point
steps, inline annotations, general feedback). A progress dashboard tracks historical
performance. Monetization is freemium: 3 free corrections, then a paywall with two
subscription tiers (entry/premium, differentiated only by monthly quota, no rollover)
billed through Asaas (card + Pix).

Technical approach: a single Next.js (TypeScript) full-stack application backed by
PostgreSQL (Prisma), with business logic organized in feature modules behind explicit
interfaces. Text extraction uses Google Cloud Vision; grading uses Claude Sonnet 4.6
with a prompt-cached ENEM rubric and structured JSON output. Essay images live briefly
in S3-compatible object storage and are deleted at transcription confirmation. Grading
runs as an in-process background task with status persisted on the submission row and
polled by the client (no queue infrastructure in v1, but the pipeline is isolated
behind a module interface so a queue can be introduced without restructuring).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS

**Primary Dependencies**: Next.js 15 (App Router), Prisma ORM, Auth.js (credentials
provider), `@anthropic-ai/sdk` (Claude Sonnet 4.6), `@google-cloud/vision`, Asaas REST
API v3 (HTTP client, no official SDK), S3-compatible client (`@aws-sdk/client-s3`) for
Cloudflare R2, Resend (transactional email), Zod (validation)

**Storage**: PostgreSQL 16 (all persistent data); Cloudflare R2 (S3-compatible) for
short-lived essay images only

**Testing**: Vitest (unit + integration, with a test Postgres via docker compose);
Playwright for the critical E2E happy path (register → upload → confirm → evaluation)

**Target Platform**: Linux server (single long-running Node process), responsive web UI
for mobile browsers (students photograph and upload from phones)

**Project Type**: Web application — single Next.js project (frontend + API in one app)

**Performance Goals**: 95% of evaluations delivered < 3 min after confirmation (SC-002);
dashboard reflects new results < 1 min (SC-006); supports 1,000 students submitting in
the same hour (SC-008)

**Constraints**: Low unit cost (~US$0.03/correction: OCR ~$0.0015 + LLM ~$0.03 with
prompt caching); LGPD compliance (account deletion, data minimization — images deleted
after confirmation per FR-027a); Brazilian Portuguese UI; payment methods: card + Pix;
v1 defaults (config-backed — R11): upload limit 10 MB, payment grace period 7 days

**Scale/Scope**: v1 targets ~10k registered students, ~1k submissions/hour peak;
11 entities; ~20 API endpoints; 6 feature modules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Código Legível Primeiro | ✅ PASS | TypeScript + Prisma schema-as-code; Zod schemas double as readable validation docs; lint/format from first commit (constitution quality gates). |
| II. Estrutura Simples | ✅ PASS | One app, one deploy, one language. No queue, no Redis, no microservices in v1. Each dependency maps to a concrete FR (Vision→FR-006, Anthropic→FR-009, Asaas→FR-023, R2→FR-027a, Resend→FR-001). |
| III. Modularidade Obrigatória | ✅ PASS | 6 modules with single responsibility and explicit public interfaces (see Source Code). Dependency direction is one-way: `app/` → modules → `lib/`. External vendors wrapped in adapters (`transcription`, `grading`, `billing`) so vendor details never leak across modules. |
| IV. Manutenibilidade como Prioridade | ✅ PASS | Vendor adapters allow swapping OCR/LLM/gateway without touching domain logic; business numbers (plan price/quota, free credits) are seed data, not code. |
| V. Preparado para Escala | ✅ PASS | App is stateless (sessions via JWT; files in object storage); costly operations (OCR, grading) isolated behind module interfaces enabling future cache/queue/parallelism; data access concentrated in Prisma within modules. No global mutable state. |

**Initial gate: PASS** — no violations to justify. **Post-design re-check (after Phase 1): PASS** — data model and contracts introduce no additional projects, layers, or speculative abstractions.

## Project Structure

### Documentation (this feature)

```text
specs/001-enem-essay-grading/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── stack.md             # Stack decisions (user-confirmed, pre-plan)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── api.md                       # HTTP API contract
│   └── evaluation-llm.schema.json   # Structured-output schema for the grading LLM
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/                          # Next.js App Router — thin: pages + route handlers only
│   ├── (auth)/                   # register, login, verify-email, reset-password pages
│   ├── (app)/                    # authenticated area
│   │   ├── dashboard/            # progress dashboard page
│   │   ├── submissions/          # upload, transcription review, evaluation view pages
│   │   └── billing/              # paywall, plans, manage subscription pages
│   └── api/                      # route handlers — delegate to modules, no business logic
│       ├── auth/[...nextauth]/
│       ├── submissions/
│       ├── dashboard/
│       ├── billing/
│       └── webhooks/asaas/
├── modules/                      # business logic — each exposes index.ts (public interface)
│   ├── auth/                     # registration, email verification, password reset
│   ├── submissions/              # submission lifecycle + status state machine
│   ├── transcription/            # OCR adapter (Google Vision) + review/confirm flow
│   ├── grading/                  # ENEM rubric engine: LLM adapter, schema validation,
│   │                             #   annotation anchoring, zero-score rules
│   ├── credits/                  # free allowance + monthly quota ledger (consume/refund)
│   ├── billing/                  # plans, Asaas adapter, webhook processing, entitlements
│   └── dashboard/                # score-evolution and per-competency aggregations
├── lib/                          # cross-cutting: prisma client, storage (R2), config,
│                                 #   email (Resend), logger
├── components/                   # shared UI components
└── instrumentation.ts            # starts interval sweeps at server boot (R6)

prisma/
├── schema.prisma
├── migrations/
└── seed.ts                       # subscription plans + config seed (business numbers)

tests/
├── unit/                         # per-module logic (credits ledger, grading validation…)
├── integration/                  # API routes against test Postgres
└── e2e/                          # Playwright happy path
```

**Structure Decision**: Single Next.js project (Option 1 adapted for App Router). The
`app/` layer stays thin (rendering + HTTP concerns); all business rules live in
`src/modules/*`, each with a single responsibility and a public `index.ts` interface.
Dependencies flow one way (`app → modules → lib`); modules never import each other's
internals — cross-module needs go through the public interface (e.g., `submissions`
calls `credits.consume()` and `grading.evaluate()`).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations — table intentionally empty.*
