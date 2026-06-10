# Research: Argos — ENEM Essay Grading Platform

**Date**: 2026-06-10 | **Plan**: [plan.md](./plan.md)

No NEEDS CLARIFICATION markers remained in the Technical Context — the core stack was
decided interactively with the user before planning (see [stack.md](./stack.md)). This
document consolidates those decisions and resolves the remaining design unknowns.

## R1. Web stack

- **Decision**: Next.js 15 (App Router) full-stack in TypeScript, deployed as a single
  long-running Node server. PostgreSQL 16 via Prisma.
- **Rationale**: One language, one app, one deploy — minimal moving parts (Constitution
  II). Long-running server (not serverless) avoids function-timeout problems for the
  30–60s grading pipeline and allows in-process background tasks.
- **Alternatives considered**: FastAPI + React (two deployables, two languages —
  rejected for added structure without concrete benefit; Anthropic/Vision SDKs are
  first-class in TS); Django full-stack (weaker fit for the interactive transcription
  review and dashboard UI).

## R2. OCR for Portuguese handwriting

- **Decision**: Google Cloud Vision `DOCUMENT_TEXT_DETECTION`.
- **Rationale**: ~US$1.50/1,000 images; dedicated handwriting model with Portuguese
  support; returns per-word confidence, which directly powers FR-007 (detect
  low-confidence extraction, inform the student, do not consume credit). Threshold
  strategy: reject when mean word confidence < 0.6 or extracted text < 7 lines
  (mirrors the spec's insufficient-text edge case); thresholds live in config.
- **Alternatives considered**: Azure AI Vision Read (comparable, no advantage to
  justify a second cloud); multimodal LLM as OCR (~US$10/1,000 — 6× cost, weaker
  confidence signal, and entangles transcription with grading vendor).

## R3. Grading LLM and prompt design

- **Decision**: Claude Sonnet 4.6 (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`, with:
  - **Structured outputs** (`output_config.format` with a JSON schema — see
    `contracts/evaluation-llm.schema.json`) so scores/annotations always parse.
  - **Prompt caching**: the full ENEM rubric (5 competencies, level descriptors per
    40-point band, zero-score conditions) goes in a frozen system block with
    `cache_control: {type: "ephemeral"}`; the per-request part (theme + confirmed
    essay text) comes after. Estimated ~US$0.03/essay; cache hits cut input cost ~90%.
  - Competency scores constrained by the schema to the official enum
    {0, 40, 80, 120, 160, 200}.
- **Rationale**: Spec demands "balanced cost-to-performance"; Sonnet 4.6 (US$3/US$15
  per MTok) is the equilibrium point for nuanced Portuguese rubric evaluation. SC-003
  (±100 points vs human grade in 80% of cases) must be validated against a benchmark
  set during implementation; if Sonnet misses the bar, Opus 4.8 is a drop-in model-id
  change in the adapter (~US$0.05/essay).
- **Alternatives considered**: Claude Haiku 4.5 (US$1/US$5 — 3× cheaper but higher
  risk on SC-003 for fine rubric judgment); Claude Opus 4.8 (US$5/US$25 — quality
  ceiling, kept as upgrade path, not default).

## R4. Payment gateway (subscriptions, card + Pix)

- **Decision**: Asaas REST API v3. One Asaas *customer* per paying student; one Asaas
  *subscription* per active plan. Entitlements are granted only on webhook confirmation.
- **Webhooks**: process at `POST /api/webhooks/asaas` with token validation; relevant
  events: payment confirmed/received (activate or renew quota), payment overdue (start
  grace period), subscription deleted (revert to free at period end). Webhook handling
  must be idempotent (event id stored, duplicates ignored) — Asaas retries deliveries.
- **Upgrade with proration (FR-025)**: Asaas does not prorate automatically. Approach:
  on upgrade, compute the unused fraction of the current cycle, issue a one-off charge
  for the price difference × remaining fraction, and update the subscription's plan and
  value for subsequent cycles. Premium quota applies immediately on charge confirmation.
- **Rationale**: subscription-first Brazilian gateway with native card/Pix/boleto and
  among the lowest fees; FR-023 satisfied without assembling recurring billing by hand.
- **Alternatives considered**: Mercado Pago (stronger brand, weaker subscriptions API
  for Pix); Stripe (best DX and native proration, but higher BR fees and weak Pix
  recurrence — fails the "low-cost + Pix" requirement).

## R5. Essay image storage and lifecycle

- **Decision**: Cloudflare R2 (S3-compatible) with direct-from-browser upload via
  presigned URL. Object deleted when: transcription confirmed, extraction failed, or
  submission abandoned (sweep job deletes objects/submissions stuck in pre-confirmation
  states for > 24h).
- **Rationale**: FR-027a makes images short-lived, so storage cost ≈ 0; R2 has no
  egress fees; presigned upload keeps large photos off the app server (helps SC-008).
- **Alternatives considered**: store image bytes in Postgres (bloats the DB, complicates
  backups for data that lives minutes); local disk (breaks statelessness —
  Constitution V).

## R6. Async processing model

- **Decision**: No queue in v1. The grading pipeline (LLM call + validation +
  persistence) runs as an in-process background task triggered at transcription
  confirmation; progress is a status field on Submission
  (`pending → extracting → awaiting_review → grading → completed | failed`); the
  client polls `GET /api/submissions/{id}` every few seconds. On grading failure the
  credit is auto-refunded (FR-015) and status set to `failed`.
- **Rationale**: a queue (Redis/BullMQ) adds two infrastructure pieces to serve a
  pipeline whose volume (≤ ~17 gradings/min at SC-008 peak) a single Node process
  handles comfortably. The pipeline sits behind `grading`'s public interface, so
  introducing a queue later is an internal change (Constitution II + V).
- **Alternatives considered**: BullMQ + Redis (deferred until measured need);
  Postgres-based job table with worker loop (adopted partially: the abandoned-submission
  sweep runs on a simple interval timer; full job orchestration deferred).

## R7. Authentication and transactional email

- **Decision**: Auth.js (NextAuth) credentials provider with JWT session strategy;
  bcrypt password hashing; email verification token required before first submission
  (FR-001) and password reset (FR-002) sent via Resend.
- **Rationale**: standard, well-documented path for Next.js; JWT sessions keep the app
  stateless (Constitution V). Resend free tier covers v1's only two email types
  (verification, reset — clarification 5 excludes notification emails).
- **Alternatives considered**: managed auth (Clerk/Auth0 — recurring cost and external
  dependency for a solved problem); session-table strategy (adds DB chatter; JWT
  suffices for a single-app deployment).

## R8. Annotation anchoring

- **Decision**: the LLM returns each annotation with an exact `excerpt` (verbatim
  substring of the confirmed text) plus issue, competency, and suggestion. The server
  locates the excerpt in the confirmed text to compute `startOffset`/`endOffset`
  (first match; annotations with unlocatable excerpts are kept but flagged
  `anchored: false` and rendered without highlight). Offsets are stored on the
  Annotation row; the UI highlights by offset range.
- **Rationale**: asking the LLM for character offsets directly is unreliable; verbatim
  excerpts validate trivially (`indexOf`) and survive re-rendering. Server-side
  anchoring keeps the contract testable (FR-011, US1 scenario 5).
- **Alternatives considered**: LLM-provided offsets (fragile); line/paragraph anchors
  (too coarse for "specific passages").

## R9. ENEM rubric encoding and zero-score rules

- **Decision**: the rubric lives as a versioned constant in `modules/grading/rubric.ts`
  — per competency, the descriptor for each of the 6 levels (0–200 in 40-point steps),
  drawn from INEP's public "Cartilha do Participante". Detectable zero-score conditions
  (FR-013: blank/insufficient text, full genre disregard, deliberate theme
  disconnection) are evaluated by the LLM and returned in a structured `zeroReason`
  field; insufficient-length is additionally pre-checked in code before spending an
  LLM call. Evaluation rows store `rubricVersion` so historical scores remain
  interpretable when the rubric prompt evolves.
- **Rationale**: rubric-as-versioned-code keeps the grading contract reviewable and
  testable (Constitution I); pre-checking cheap zero conditions in code saves LLM cost.
- **Alternatives considered**: rubric in DB (no reviewability gain, complicates prompt
  caching); separate LLM pass per competency (5× cost, loses cross-competency context).

## R10. Hosting & operations

- **Decision**: Railway (or Render — interchangeable) running one Node service +
  managed PostgreSQL; R2 on Cloudflare. Horizontal scale = add instances (app is
  stateless). Structured JSON logging via a thin `lib/logger`; vendor calls log
  duration + outcome for cost/latency observability.
- **Rationale**: cheapest operational path that preserves the scale story; no
  Kubernetes/IaC ceremony for v1.
- **Alternatives considered**: Vercel (serverless function timeouts conflict with the
  in-process pipeline); VPS (cheaper at scale but adds ops burden now).

## R11. Business numbers as configuration

- **Decision**: plan prices and quotas, free-credit count (3), OCR confidence
  thresholds, and grace-period length are **seed/config data** (`prisma/seed.ts` +
  environment-backed config in `lib/config.ts`) — never literals in business logic.
- **Rationale**: the spec deliberately leaves pricing as a business lever; this makes
  changing it a data update, not a deploy (and honors the constitution's
  configuration-out-of-code rule).
- **Alternatives considered**: hardcoding v1 numbers (cheaper now, guaranteed rework).
