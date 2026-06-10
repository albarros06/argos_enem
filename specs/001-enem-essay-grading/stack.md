# Argos — Stack Decisions

**Date**: 2026-06-10
**Status**: Decided with the user before `/speckit-plan`. These choices are input to the
Technical Context of plan.md. Rationale follows the constitution: readable code, simple
modular structure, easy maintainability, scale-ready, low cost.

## Core decisions (user-confirmed)

| Area | Decision | Rationale |
|------|----------|-----------|
| Web stack | **Next.js full-stack (TypeScript)**, deployed as a long-running Node server | One language end-to-end, one app, one deploy; App Router pages + API route handlers. Fewest moving parts (Constitution II). |
| Database | **PostgreSQL** | Default relational choice; fits users/submissions/evaluations/subscriptions model. |
| OCR | **Google Cloud Vision** (`DOCUMENT_TEXT_DETECTION`) | ~US$1.50/1,000 images; dedicated handwriting recognition with Portuguese support; per-word confidence enables FR-007 (low-confidence detection without consuming credit). |
| Grading LLM | **Claude Sonnet 4.6** (`claude-sonnet-4-6`) via Anthropic TypeScript SDK | US$3/US$15 per MTok ≈ US$0.03/essay with the ENEM rubric in a prompt-cached system block. Structured outputs (`output_config.format` JSON schema) guarantee parseable scores + annotations. Balanced cost-to-performance per spec. |
| Payments | **Asaas** | Brazilian subscription-first gateway: recurring card, Pix and boleto native in the subscriptions API; among the lowest fees in BR. Covers FR-023 (card + Pix) directly. |

## Supporting defaults (proposed, adjustable at plan time)

- **Essay image storage**: S3-compatible object storage (e.g., Cloudflare R2 — no egress
  fees). Images are short-lived per spec (deleted at transcription confirmation /
  failure / abandonment — FR-027a), so storage cost is negligible.
- **Async processing**: no Redis/queue in v1. Grading (~30–60s) runs as a background
  task in the Node process with status persisted on the Submission row; the frontend
  polls submission status (satisfies in-app notification, per clarification 5).
  Isolate the pipeline behind a module interface so a real queue can be added later
  without restructuring (Constitution V).
- **Auth**: Auth.js (NextAuth) with credentials provider — email + password, email
  verification required before first submission (FR-001).
- **Transactional email**: Resend (free tier) — needed only for email verification and
  password reset; no marketing/notification email in v1 (clarification 5).
- **ORM/migrations**: Prisma (readable schema-as-code, aligned with Constitution I).
- **Hosting**: single Node server + managed PostgreSQL (e.g., Railway or Render);
  scale path is horizontal instances behind the platform's load balancer — the
  stateless-app constraint of Constitution V makes this possible.

## Per-essay unit cost estimate (v1)

| Item | Cost |
|------|------|
| OCR (1 image) | ~US$0.0015 |
| LLM grading (≈3K in / 1.5K out, rubric cached) | ~US$0.03 |
| **Total per correction** | **~US$0.03 (≈R$0.17)** |

Pricing of subscription tiers must clear this unit cost with ample margin; exact prices
remain a business decision (see spec Assumptions).
