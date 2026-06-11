# Tasks: Argos — ENEM Essay Grading Platform

**Input**: Design documents from `/specs/001-enem-essay-grading/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/evaluation-llm.schema.json, quickstart.md

**Tests**: Included — the project constitution mandates that new functionality ships with tests covering the affected module's public behavior (Restrições e Padrões de Qualidade). Vendor adapters ship fake in-memory implementations so no external calls happen in CI (quickstart).

**Organization**: Tasks are grouped by user story so each story is an independently implementable, testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US4) — only on user-story phase tasks
- Every task includes exact file paths

## Path Conventions

Single Next.js project at repository root (plan.md): `src/app/` (pages + route handlers, thin), `src/modules/` (business logic, public `index.ts` per module), `src/lib/` (cross-cutting), `src/components/` (shared UI), `prisma/`, `tests/{unit,integration,e2e}`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, tooling, and quality gates (linter/formatter from first commit per constitution)

- [X] T001 Initialize Next.js 15 (App Router) project with TypeScript 5.x on Node 22, pnpm, and the directory skeleton from plan.md (`src/app/`, `src/modules/`, `src/lib/`, `src/components/`, `prisma/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`) at repository root
- [X] T002 Install core dependencies: `prisma`, `@prisma/client`, `next-auth` (Auth.js v5), `zod`, `bcrypt`, `@anthropic-ai/sdk`, `@google-cloud/vision`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `resend` in `package.json`
- [X] T003 [P] Configure ESLint + Prettier with `pnpm lint` and `pnpm format:check` scripts in `eslint.config.mjs`, `.prettierrc`, `package.json`
- [X] T004 [P] Create `docker-compose.yml` with PostgreSQL 16 services for dev and test databases
- [X] T005 [P] Create `.env.example` with all keys from quickstart.md (DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY, GOOGLE_APPLICATION_CREDENTIALS_JSON, R2_*, ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, RESEND_API_KEY, APP_URL) and a Zod-validated config loader in `src/lib/config.ts` (env + business thresholds: OCR confidence ≥ 0.6, min 7 lines, free-credit count, upload size limit 10 MB, grace period 7 days, confirm-text length-ratio bounds 0.5×–2× — R11)
- [X] T006 [P] Configure Vitest for unit + integration tests (test Postgres via docker compose, setup/teardown helpers) in `vitest.config.ts` and `tests/setup.ts`
- [X] T007 [P] Configure Playwright in `playwright.config.ts` with a `tests/e2e/` project targeting the dev server

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, cross-cutting libs, authentication, and the credits ledger — required by ALL user stories (credits serve US1 consume/refund, US3 paywall, US4 quota)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Define the complete Prisma schema (User, Submission + status/failureReason enums, Transcription, Evaluation with competency-score check constraints, Annotation, CreditTransaction + kind enum, SubscriptionPlan, Subscription + status enum, PaymentTransaction, EssayTheme, WebhookEvent) per data-model.md in `prisma/schema.prisma`, and generate the initial migration in `prisma/migrations/`
- [X] T009 Create seed script with the two SubscriptionPlans (entry/premium with priceCents and monthlyQuota as seed data, not code), an EssayTheme catalog of past ENEM themes, and config rows in `prisma/seed.ts`
- [X] T010 [P] Create the Prisma client singleton in `src/lib/prisma.ts`
- [X] T011 [P] Create the structured JSON logger (vendor-call duration + outcome fields for cost/latency observability — R10) in `src/lib/logger.ts`
- [X] T012 [P] Create the R2 storage adapter (presigned upload URL generation, object delete, key naming) in `src/lib/storage.ts`
- [X] T013 [P] Create the Resend email sender with pt-BR verification and password-reset templates in `src/lib/email.ts`
- [X] T014 [P] Create API route helpers: error envelope `{error: {code, message}}`, error codes from contracts/api.md (UNAUTHENTICATED, EMAIL_NOT_VERIFIED, PAYWALL, DUPLICATE_IMAGE, INVALID_STATE, VALIDATION_ERROR), and a Zod request-validation wrapper in `src/lib/api.ts`
- [X] T015 Implement auth module core: registration with bcrypt hashing, email-verification token issue/validate, password-reset token issue/apply, public interface in `src/modules/auth/index.ts`
- [X] T016 Configure Auth.js credentials provider with JWT session strategy and a `requireUser()` session helper that also exposes `emailVerifiedAt` in `src/lib/auth.ts` and `src/app/api/auth/[...nextauth]/route.ts`
- [X] T017 Implement auth API routes: POST `/api/auth/register` (sends verification email), POST `/api/auth/verify-email` (200/410), POST `/api/auth/resend-verification` (rate-limited), POST `/api/auth/forgot-password` (always 200), POST `/api/auth/reset-password` in `src/app/api/auth/*/route.ts`
- [X] T018 Build auth pages (pt-BR, mobile-responsive): register, login, verify-email, reset-password in `src/app/(auth)/*/page.tsx`
- [X] T019 Implement credits module: append-only CreditTransaction ledger with `grantSignup` (3 credits from config, wired into registration), `consume` (quota-first order, balance check + insert in one DB transaction), `refund`, `balance` (split free/quota, cycleEndsAt), public interface in `src/modules/credits/index.ts`
- [X] T020 [P] Unit tests for the credits ledger (signup grant, quota-first consumption order, concurrent-consume safety, refund, expiry netting) in `tests/unit/credits.test.ts`
- [X] T021 [P] Integration tests for the auth flow (register → verify → login; unverified login blocked from submission; reset password) in `tests/integration/auth.test.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Submit Handwritten Essay and Receive Evaluation (Priority: P1) 🎯 MVP

**Goal**: A verified student uploads an essay photo with a theme, reviews/corrects the OCR transcription, confirms (credit consumed atomically, image deleted), and receives a full ENEM evaluation: total score, 5 competency scores in 40-point steps, anchored inline annotations, and general feedback — with in-app status polling.

**Independent Test**: Register a new account, upload a legible handwritten-essay photo, confirm the transcription, and verify a complete evaluation (total score, 5 competency scores, ≥1 anchored annotation, feedback comment) is delivered, stored, and viewable with highlights.

### Implementation for User Story 1

- [X] T022 [P] [US1] Implement transcription module: Google Vision `DOCUMENT_TEXT_DETECTION` adapter returning text + mean word confidence, low-confidence/short-text rejection using thresholds from config (FR-007), plus a fake in-memory adapter for tests, behind `src/modules/transcription/index.ts`
- [X] T023 [P] [US1] Encode the versioned ENEM rubric (5 competencies × 6 level descriptors from INEP's Cartilha, zero-score conditions, `RUBRIC_VERSION` constant — R9) in `src/modules/grading/rubric.ts`
- [X] T024 [P] [US1] Create the Zod schema mirroring `contracts/evaluation-llm.schema.json` (competency scores constrained to {0,40,80,120,160,200}, annotations with verbatim excerpts, zeroReason enum) in `src/modules/grading/schema.ts`
- [X] T025 [US1] Implement the grading LLM adapter: Claude Sonnet 4.6 via `@anthropic-ai/sdk` with structured JSON output and the rubric in a prompt-cached system block (`cache_control: ephemeral`), model id from config, plus a fake adapter for tests, in `src/modules/grading/llm.ts`
- [X] T026 [US1] Implement annotation anchoring: locate each verbatim excerpt in the confirmed text (`indexOf`, first match), compute `startOffset`/`endOffset`, flag unlocatable excerpts `anchored: false` (R8) in `src/modules/grading/anchoring.ts`
- [X] T027 [US1] Implement the grading pipeline as an in-process background task behind `src/modules/grading/index.ts`: pre-check insufficient text in code (zero without LLM call — R9), call LLM, validate with schema, anchor annotations, persist Evaluation (including per-competency justifications) + Annotations with `rubricVersion`/`modelId`, log a warning when a non-zero-scored evaluation has fewer than 3 annotations (SC-005), and on any failure mark submission failed + auto-refund credit via `credits.refund()` (FR-015)
- [X] T028 [US1] Implement the submission status state machine (pending → awaiting_review → grading → completed | failed | expired, with legal-transition guards as single source of truth) in `src/modules/submissions/stateMachine.ts`
- [X] T029 [US1] Implement submissions module services in `src/modules/submissions/index.ts`: `create` (guards: email verified, credit/quota available, size/format limits, duplicate `imageSha256` warning with force override; returns presigned upload URL), `markUploaded` (triggers OCR → awaiting_review or failed with image deleted, no credit consumed), `confirm` (validate confirmedText against the length-ratio and min-lines config bounds, consume credit atomically, delete R2 image, start grading pipeline), `abandon` (delete image, status expired), `get`, `list` (paginated, owner-scoped — FR-003)
- [X] T030 [US1] Implement the abandoned-submission sweep (interval timer: pre-confirmation submissions older than 24h → delete image, status expired — R5/R6) in `src/modules/submissions/sweep.ts`, started with the server in `src/instrumentation.ts`
- [X] T031 [US1] Implement submission API routes per contracts/api.md: POST `/api/submissions`, POST `/api/submissions/[id]/uploaded`, POST `/api/submissions/[id]/confirm` (409 INVALID_STATE when not awaiting_review), DELETE `/api/submissions/[id]`, GET `/api/submissions/[id]` (polling shape with transcription/evaluation), GET `/api/submissions` in `src/app/api/submissions/**/route.ts`
- [X] T032 [P] [US1] Build the upload page (photo picker with client-side sha256, JPEG/PNG + size validation before upload, theme select-from-catalog or free-form, direct-to-R2 presigned upload, duplicate warning dialog) in `src/app/(app)/submissions/new/page.tsx`
- [X] T033 [P] [US1] Build the transcription review page (editable extracted text, confidence notice, confirm button with credit-consumption notice, abandon option) in `src/app/(app)/submissions/[id]/review/page.tsx`
- [X] T034 [P] [US1] Build the submission detail page: processing-status polling (GET every few seconds), ready indicator, and the evaluation view — total score, per-competency scores with their justifications, confirmed text with annotations highlighted by offset range, unanchored annotations listed separately, general feedback, zeroReason explanation, failure states with retake guidance — in `src/app/(app)/submissions/[id]/page.tsx` and `src/components/AnnotatedText.tsx`
- [X] T035 [US1] Build the submissions list page (date, theme, status, total score, "result ready" badge for completed submissions not yet viewed, link to detail) in `src/app/(app)/submissions/page.tsx`
- [X] T036 [P] [US1] Unit tests for state-machine transitions, annotation anchoring (found/duplicate/missing excerpts), and LLM output schema validation (invalid scores rejected; non-zero-scored evaluation with <3 annotations triggers the SC-005 warning) in `tests/unit/submissions-state.test.ts`, `tests/unit/anchoring.test.ts`, `tests/unit/grading-schema.test.ts`
- [X] T037 [P] [US1] Integration tests for the submission lifecycle with fake adapters: create → uploaded → confirm → completed; extraction failure consumes no credit (FR-007); grading failure refunds credit (FR-015); confirm in wrong state → 409; cross-user access → 404 in `tests/integration/submissions.test.ts`
- [X] T038 [US1] Playwright E2E happy path: register → verify (dev-log link) → upload → review/confirm → poll → evaluation visible with annotations in `tests/e2e/happy-path.spec.ts`

**Checkpoint**: Core product loop fully functional — MVP deliverable

---

## Phase 4: User Story 2 - Track Historical Performance on a Progress Dashboard (Priority: P2)

**Goal**: A returning student sees total-score evolution over time, per-competency latest/average/trend (weakest/strongest), submission count, and links to every past evaluation — with baseline and empty states.

**Independent Test**: Seed an account with two or more completed evaluations and verify the dashboard shows the score series, per-competency breakdown, and working links to each evaluation; verify single-evaluation baseline and zero-submission empty states.

### Implementation for User Story 2

- [X] T039 [US2] Implement dashboard module aggregations (owner-scoped queries over Evaluation⋈Submission: score series by date, per-competency latest/average/trend, submission count — plain indexed queries, no materialized views) behind `src/modules/dashboard/index.ts`
- [X] T040 [US2] Implement GET `/api/dashboard` returning `{scoreSeries, competencies, submissionCount}` per contracts/api.md in `src/app/api/dashboard/route.ts`
- [X] T041 [US2] Build the dashboard page: score-evolution chart, per-competency cards highlighting weakest/strongest, past-submission list linking to evaluations, baseline state for one evaluation, empty state with submit CTA, in `src/app/(app)/dashboard/page.tsx`
- [X] T042 [P] [US2] Tests: unit tests for trend/average computation in `tests/unit/dashboard.test.ts`; integration tests for GET `/api/dashboard` with 0, 1, and N evaluations and user scoping in `tests/integration/dashboard.test.ts`

**Checkpoint**: US1 + US2 work independently — retention loop in place

---

## Phase 5: User Story 3 - Free Allowance and Paywall (Priority: P3)

**Goal**: New accounts get 3 free credits with the balance always visible; when credits and quota are exhausted, submission attempts are blocked by a paywall showing the plans — while all past content stays accessible.

**Independent Test**: Consume all free credits on a new account and verify the next submission attempt returns 402 PAYWALL with plans before any upload is processed, the UI shows the paywall, and past evaluations/dashboard remain fully accessible.

### Implementation for User Story 3

- [X] T043 [US3] Implement GET `/api/credits` returning `{freeRemaining, quotaRemaining, cycleEndsAt?}` from `credits.balance()` in `src/app/api/credits/route.ts`
- [X] T044 [US3] Implement billing module read side: `listActivePlans()` in `src/modules/billing/index.ts` and GET `/api/billing/plans` in `src/app/api/billing/plans/route.ts`
- [X] T045 [US3] Enforce the paywall in submission creation: zero balance → 402 `PAYWALL` with available plans in the body, before any upload processing (FR-021), in `src/modules/submissions/index.ts` and POST `/api/submissions`
- [X] T046 [US3] Build the credit-balance UI: persistent balance indicator in the app shell in `src/components/CreditBalance.tsx`, last-credit-used messaging, and the paywall page presenting both plans with benefits in `src/app/(app)/billing/page.tsx`; redirect blocked submission attempts to it
- [X] T047 [P] [US3] Integration tests: new account has 3 credits; balance reaches 0 after third confirm; 0 credits + no subscription → 402 with plans; past evaluations and dashboard still readable at 0 credits in `tests/integration/paywall.test.ts`

**Checkpoint**: Freemium gate operational — funnel measurable

---

## Phase 6: User Story 4 - Subscribe, Upgrade, and Manage Plans (Priority: P4)

**Goal**: A paywalled student subscribes (card or Pix) via Asaas, gets quota immediately on payment-confirmed webhook, can upgrade entry→premium with proration, cancel keeping access until period end, and is offered the upsell when quota runs out.

**Independent Test**: From the paywall, complete an Asaas-sandbox payment and verify quota is granted only on webhook confirmation; upgrade and verify the prorated charge and immediate premium quota; cancel and verify access persists until period end.

### Implementation for User Story 4

- [X] T048 [US4] Implement the Asaas REST API v3 adapter (create customer, create subscription, one-off charge, update subscription value/plan, cancel; card + Pix) plus a fake in-memory adapter for tests in `src/modules/billing/asaas.ts`
- [X] T049 [US4] Implement the subscribe service: lazy Asaas customer creation (store `asaasCustomerId`), create subscription + PaymentTransaction (status pending), return `{status, pixQrCode?}`, grant NO entitlements before webhook confirmation (FR-024) in `src/modules/billing/index.ts`
- [X] T050 [US4] Implement webhook processing in `src/modules/billing/webhooks.ts`: validate access token header, enforce idempotency via `WebhookEvent.id` (duplicates → 200 no-op), payment confirmed → activate/renew subscription + `quota_grant`, payment overdue → `past_due` grace period, subscription deleted → revert at period end (R4)
- [X] T051 [US4] Implement quota-cycle management in `src/modules/billing/cycles.ts`: set `currentPeriodStart/End` on confirmation, insert `quota_expiry` netting unused quota to zero at cycle end (no rollover — FR-022), and expire `past_due` subscriptions after the configured grace period (interval sweep alongside T030)
- [X] T052 [US4] Implement upgrade with proration (compute unused cycle fraction, one-off charge for the price difference × fraction, switch planId + grant quota difference on charge confirmation, 409 if already premium) and cancel-at-period-end (entitlements retained until `currentPeriodEnd` — FR-025) in `src/modules/billing/index.ts`
- [X] T053 [US4] Implement billing API routes per contracts/api.md: POST `/api/billing/subscribe`, POST `/api/billing/upgrade`, POST `/api/billing/cancel`, GET `/api/billing/subscription` in `src/app/api/billing/**/route.ts`, and POST `/api/webhooks/asaas` in `src/app/api/webhooks/asaas/route.ts`
- [X] T054 [P] [US4] Build the checkout flow on the plans page: plan selection, card form (tokenized) and Pix QR display with pending-payment state, success/failure feedback in `src/app/(app)/billing/checkout/page.tsx`
- [X] T055 [P] [US4] Build the manage-subscription page (current tier, status, quota usage, period end, cancel with confirmation, upgrade CTA, and — for Pix subscribers with a pending cycle charge — the charge's Pix QR fetched via the Asaas adapter) in `src/app/(app)/billing/manage/page.tsx`, plus a pending-renewal banner in the app shell in `src/components/RenewalBanner.tsx`
- [X] T056 [US4] Implement the upsell path: when an entry-tier subscriber exhausts quota, the submission block offers the premium upgrade or next-cycle date (FR-026) in the paywall logic of `src/modules/submissions/index.ts` and `src/app/(app)/billing/page.tsx`
- [X] T057 [P] [US4] Unit tests for proration math, quota-expiry ledger netting, and grace-period transitions in `tests/unit/billing.test.ts`
- [X] T058 [P] [US4] Integration tests with the fake Asaas adapter: subscribe grants nothing pre-webhook; payment-confirmed webhook grants quota exactly once (duplicate event ignored); overdue → grace → expired; cancel keeps access until period end in `tests/integration/billing.test.ts`

**Checkpoint**: Full funnel complete — all user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Compliance, hardening, and validation across stories

- [X] T059 Implement LGPD account deletion (FR-028): DELETE `/api/account` returning 202 + async job (revoke sessions → cancel Asaas subscription → delete remaining R2 objects → delete Annotations/Evaluations/Transcriptions/Submissions/CreditTransactions → anonymize PaymentTransactions → delete User) in `src/modules/auth/deletion.ts` and `src/app/api/account/route.ts`, with integration test in `tests/integration/account-deletion.test.ts`
- [X] T060 [P] Mobile-responsiveness and pt-BR copy pass across all pages (students upload from phones) in `src/app/**` and `src/components/**`
- [X] T061 [P] Security hardening audit: every query owner-scoped (FR-003), webhook token validation, presigned-URL content-type/size constraints, rate limits on auth endpoints, no secrets in logs, in `src/app/api/**` and `src/lib/**`
- [X] T062 [P] Write the project README (setup, architecture overview, module map) in `README.md`
- [ ] T063 Validate grading accuracy against a benchmark set of essays with known human grades (SC-003: 80% within ±100 points; competency within one step in 70%); tune rubric prompt and bump `rubricVersion` if needed, in `src/modules/grading/rubric.ts`
  - **Status 2026-06-11**: blocked on external inputs — requires a human-graded benchmark essay set and a live `ANTHROPIC_API_KEY` (vendor keys are empty in the dev `.env`)
- [ ] T064 Run full quickstart.md validation end-to-end (core loop + Asaas sandbox billing flow) and fix any gaps; ensure `pnpm lint && pnpm format:check && pnpm test && pnpm test:e2e` all pass
  - **Status 2026-06-11**: local portion DONE — all four gates pass; core loop validated via Playwright E2E and billing via integration tests with the fake Asaas adapter. Remaining: real Asaas-sandbox verification (needs a sandbox API key + public webhook tunnel)
- [X] T065 [P] Load-test the submission lifecycle with fake vendor adapters (k6 or artillery): simulate 1,000 students submitting within one hour and assert p95 confirm→completed time < 3 min (SC-002, SC-008) in `tests/load/submissions.js`, with a `pnpm test:load` script in `package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational only
- **US2 (Phase 4)**: Depends on Foundational; needs completed Evaluations to display (seedable for independent testing)
- **US3 (Phase 5)**: Depends on Foundational (credits ledger T019); plans read-side (T044) needs seed data (T009)
- **US4 (Phase 6)**: Depends on Foundational + US3 (paywall is the entry point; T056 extends T045)
- **Polish (Phase 7)**: T059 touches all modules — after US4; T063 after T027

### Key Task Dependencies

- T008 (schema) blocks T009, T010, and all module work
- T019 (credits) blocks T027, T029, T045, T050, T051
- T025–T027 (grading chain) sequential; T028 → T029 → T030/T031
- T048 (Asaas adapter) blocks T049–T053
- UI tasks (T032–T035, T041, T046, T054–T055) depend on their corresponding API routes

### Parallel Opportunities

- Phase 1: T003–T007 in parallel after T001–T002
- Phase 2: T010–T014 in parallel after T008; T020–T021 in parallel at phase end
- Phase 3: T022, T023, T024 in parallel (different files); UI pages T032–T034 in parallel after T031; tests T036–T037 in parallel
- After Phase 2, US1 and US2's module/API work can proceed in parallel by different developers (US2 tested with seeded data); US3 can also start (credits ledger already exists)

---

## Parallel Example: User Story 1

```bash
# Launch independent grading-module foundations together:
Task: "Transcription module with Vision adapter in src/modules/transcription/"     # T022
Task: "ENEM rubric versioned constant in src/modules/grading/rubric.ts"            # T023
Task: "Zod schema for LLM output in src/modules/grading/schema.ts"                 # T024

# After API routes (T031), build UI pages together:
Task: "Upload page in src/app/(app)/submissions/new/page.tsx"                      # T032
Task: "Transcription review page in src/app/(app)/submissions/[id]/review/"        # T033
Task: "Status polling + evaluation view in src/app/(app)/submissions/[id]/"        # T034
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T007)
2. Complete Phase 2: Foundational (T008–T021) — CRITICAL, blocks everything
3. Complete Phase 3: US1 (T022–T038)
4. **STOP and VALIDATE**: run the quickstart core-loop check — register, upload, confirm, receive evaluation
5. Deploy/demo: a working ENEM essay grader with 3 free corrections per account

### Incremental Delivery

1. Setup + Foundational → auth, DB, credits ready
2. US1 → independent test → **MVP deploy** (core grading loop)
3. US2 → independent test → deploy (retention dashboard)
4. US3 → independent test → deploy (freemium gate live)
5. US4 → independent test in Asaas sandbox → deploy (monetization complete)
6. Polish → LGPD deletion, hardening, SC-003 benchmark, full quickstart validation

### Parallel Team Strategy

After Foundational completes: Developer A takes US1 (largest story); Developer B takes US2 + US3 (both small, only touch dashboard/credits read-side); US4 starts once US3's paywall lands. Stories integrate without breaking each other — each is gated by its own checkpoint.
