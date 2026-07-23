# Tasks: Pre-Launch Security Audit

**Feature**: `015-security-audit` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Deliverables**: `specs/015-security-audit/report.md` (per `contracts/report-format.md`) and `specs/015-security-audit/coverage.md` (per `contracts/coverage-matrix.md`).

**Nature of these tasks**: This is a **read-only, non-destructive audit**. "Implementing" a task means *investigating* a target and *recording* findings + coverage rows — never modifying application source (FR-014) and never running destructive/intrusive tests (FR-013). The only files written are the two deliverables above.

**Inputs locked**: audited commit = current `015-security-audit` HEAD · staging URL = `https://argos-enem.vercel.app` · a test login is available (kept ephemeral — never write it into any file).

**Guardrails on every task**: no source edits; no `git commit`; staging requests are `curl -sI`-style or a *single* benign authenticated request — no flooding, no brute force; any finding needing intrusive proof is recorded as `potential` with a verification step.

---

## Phase 1: Setup

- [ ] T001 Record audit scope in `specs/015-security-audit/report.md` header: current commit SHA (`git rev-parse HEAD`), date, staging URL `https://argos-enem.vercel.app`, auditor. Create the `report.md` skeleton with all sections from `contracts/report-format.md` (Launch-Blocking Summary, All Findings, Coverage & Scope, Notes).
- [ ] T002 Create the `specs/015-security-audit/coverage.md` skeleton with the two matrices (Area coverage, Route authorization) and Notes section per `contracts/coverage-matrix.md`; pre-fill the six Area rows with `coverage`/`outcome` left `TBD`.

## Phase 2: Foundational (blocks US2, US6, data-exposure)

- [ ] T003 Enumerate every route handler: `find src/app/api -name route.ts` (expect 43); for each, list the exported HTTP methods (`GET`/`POST`/`PATCH`/`DELETE`). Write one stub row per method into the Route authorization matrix in `coverage.md` with `Classification=TBD`.
- [ ] T004 Read `src/lib/auth.ts` in full and catalog the available gates (`requireUser`, `requireVerifiedUser`, `requireAdmin`) and the webhook/cron secret-check patterns, plus `src/lib/api.ts` (`handleRoute`/`ApiError`) so classification in US2 is accurate. Record the gate catalog in `coverage.md` Notes.

## Phase 3: User Story 2 — Auth/authz coverage + data exposure (Priority: P1)

**Goal**: Every non-public route accounted for as protected-and-verified or flagged; object routes checked for IDOR/BOLA; PII/essay endpoints confirmed owner-scoped (FR-016).

**Independent test**: Route authorization matrix in `coverage.md` has a row for every one of the 43 handlers' methods; each protected route states auth + role + object-scoping; every gap has a matching `SEC-###` in `report.md`.

- [ ] T005 [US2] Classify each non-object route (e.g. `/api/submissions`, `/api/dashboard`, `/api/account`, `/api/credits`, `/api/billing/*`, `/api/weekly-themes/*`) by tracing its handler's first guard call; fill `Classification` + `Evidence (file:line)` in the `coverage.md` route matrix.
- [ ] T006 [P] [US2] Classify all `/api/admin/*` routes: confirm each calls `requireAdmin` (role check at `src/lib/auth.ts:69-71`) before any logic; any admin route missing it → `UNGUARDED` Finding in `report.md`.
- [ ] T007 [P] [US2] Classify secret-gated routes: `/api/webhooks/asaas` (token) and `/api/cron/sweep` (Bearer CRON_SECRET) — confirm the check precedes all side effects and rejects empty/misconfigured secrets.
- [ ] T008 [US2] IDOR/BOLA pass on object-scoped routes (`/api/submissions/[id]`, `/api/submissions/[id]/*`, `/api/groups/[id]`, `/api/groups/[id]/*`, `/api/groups/[id]/members/[userId]`, `/api/groups/[id]/themes/[themeId]*`, `/api/admin/weekly-themes/[id]*`): verify each DB query filters by the caller's ownership/membership, not just the path id. Record `Object-scoped=yes/no` per row; any `no` on a protected route → Finding.
- [ ] T009 [US2] Verify `trustHost: true` host-handling on Vercel (the stale `não Vercel` comment lead): determine whether host-header/canonical-URL trust is exploitable (e.g., password-reset link poisoning via `APP_URL`/host). Record as Finding (severity per rubric) or as reviewed-no-issue; correct-comment recommendation either way.
- [ ] T010 [P] [US2] Non-destructive authenticated staging check: one benign login via the test account to `https://argos-enem.vercel.app`, capture the **session cookie flags** (`Secure`/`HttpOnly`/`SameSite`) from the `set-cookie` response (feeds US6 too), and confirm an authenticated GET returns only the caller's own data on one object endpoint. Do not enumerate other users' ids. Record cookie flags in `coverage.md` Notes.

**Checkpoint**: US2 findings + full route matrix recorded.

## Phase 4: User Story 3 — Payment & credit integrity (Priority: P1)

**Goal**: Payment webhooks unforgeable; credits cannot be double-spent under concurrency.

**Independent test**: `report.md` states whether the Asaas webhook verifies authenticity before state change, and whether credit-spend is atomic — each with `file:line` evidence.

- [ ] T011 [US3] Review `src/app/api/webhooks/asaas/route.ts` + `src/modules/billing/webhooks.ts`: confirm the `asaas-access-token` gate covers all state transitions, rejects empty/misconfigured token, and processing is idempotent for duplicate deliveries. Record outcome/Finding.
- [ ] T012 [US3] Trace the credit-spend path (submission → credit debit) through `src/modules/billing/**` and the submissions module: determine whether the debit is atomic/transactional (DB transaction or conditional update) or a check-then-act race allowing double-spend. Record as Finding (likely High if racy) or reviewed-no-issue with the transaction `file:line`.

**Checkpoint**: money paths adjudicated.

## Phase 5: User Story 4 — Secret exposure (Priority: P2)

**Goal**: No secret committed, in history, or shipped to the browser.

**Independent test**: `report.md` lists any reachable secret or states none found, for tree + history + client surface.

- [ ] T013 [US4] Scan the working tree: `grep -rniE` for provider key shapes (Google/AWS/`AKIA`, Anthropic `sk-ant`, Asaas, Resend `re_`, `-----BEGIN.*PRIVATE KEY-----`) and confirm `.env*` is gitignored and untracked (`git ls-files | grep -i env`). Record findings.
- [ ] T014 [P] [US4] Scan git history for the same patterns: `git log -p -S…` / `git grep` across `$(git rev-list --all)` for the highest-signal tokens. Record any secret ever committed (even if later removed → rotate recommendation).
- [ ] T015 [P] [US4] Client-exposure check: confirm no server secret from `src/lib/config.ts` `env()` is read in a client component or exposed via a `NEXT_PUBLIC_*` var; grep client surface. Record outcome.

**Checkpoint**: secret surface adjudicated.

## Phase 6: User Story 5 — Dependency CVEs (Priority: P2)

**Goal**: Known-vulnerable packages surfaced with severity + fix; risky pre-release pins noted.

**Independent test**: `report.md` lists each advisory (package, severity, fixed version) and flags `next-auth` beta.

- [ ] T016 [US5] Run `pnpm audit --json`; record each advisory (package, severity, vulnerable range, fixed version) as findings grouped by severity in `report.md`.
- [ ] T017 [P] [US5] Flag security-critical pre-release pins from `package.json`: `next-auth@5.0.0-beta.31` (auth-critical beta) and note Next 15 currency; recommend the stable target versions.

**Checkpoint**: dependency risk recorded.

## Phase 7: User Story 6 — Runtime hardening & dev stubs (Priority: P3)

**Goal**: Security headers, cookie flags, HTTPS, rate limiting assessed against staging; dev stub routes gated out of production.

**Independent test**: `report.md` states presence/absence of each hardening control (staging-verified or operator-verification item) and flags any dev stub reachable in production.

- [ ] T018 [US6] Static: confirm neither `next.config.ts` nor `vercel.json` defines a `headers` block → record the "no security headers" Finding; corroborate against staging with `curl -sI https://argos-enem.vercel.app/` for CSP/X-Content-Type-Options/X-Frame-Options/Referrer-Policy/Permissions-Policy (HSTS + HTTP→HTTPS already confirmed present). Include exact missing-header list.
- [ ] T019 [P] [US6] Check `access-control-allow-origin` on `/api/**` (not just the document): issue a bounded number of `curl -sI` requests to a couple of API routes on staging; a wildcard CORS header on authenticated JSON endpoints → Finding. Record outcome.
- [ ] T020 [P] [US6] Read `src/app/api/fake-outbox/route.ts` and `src/app/api/fake-upload/[...key]/route.ts` fully: determine whether they are gated (env/`NODE_ENV`) out of production. If reachable in prod → Finding with recommendation to disable/remove.
- [ ] T021 [US6] Rate-limiting check on abuse-prone endpoints (login, `/api/auth/register`, `/api/auth/forgot-password`, `/api/submissions`): static review for any limiter, plus a **small, bounded** (≤5) request probe on staging to observe 429/limit headers — no brute force. Combine with the weak-password observation to assess account-takeover risk. Record Finding or operator-verification item.

**Checkpoint**: runtime posture recorded.

## Phase 8: User Story 1 — Report assembly & verdict (Priority: P1, aggregates all)

**Goal**: A decision-ready, severity-ordered report a non-author can act on.

**Independent test**: A reader using only `report.md` can list every launch-blocking issue and the fix order (SC-003).

- [ ] T022 [US1] Assign final `severity` (4-tier) and `launch_blocking` flag to every finding per the `data-model.md` rubric; assign stable `SEC-###` ids; order findings Critical→Low then blocking-first (report-format CR-1).
- [ ] T023 [US1] Populate the Launch-Blocking Summary table with exactly the `launch_blocking=yes` findings (or "No launch-blocking findings."); set the `Verdict` (any blocker ⇒ not GO) (CR-2, CR-6).
- [ ] T024 [US1] Write the Coverage & Scope section: link `coverage.md`, and fill the **Limitations / operator-verification items** subsection (present even if "None") (FR-015, CR-5).

## Phase 9: Polish & validation (cross-cutting)

- [ ] T025 Verify `coverage.md` completeness: all six Area rows have an explicit `Outcome` (no silent omissions, FR-012/SC-004); every one of the 43 handlers appears in the route matrix (SC-001); every `UNGUARDED`/unscoped row maps to a `SEC-###` (CR-3).
- [ ] T026 Validate `report.md` against `contracts/report-format.md`: every finding has all fields, `Remediation` never empty/"TODO" (SC-002), every `potential` finding has a non-destructive Verification step (CR-4).
- [ ] T027 Final guardrail check: confirm no application source file was modified (`git status` shows only `specs/015-security-audit/**` changed) and no commit was made (FR-013/FR-014/SC-005).

---

## Dependencies & execution order

- **Setup (T001–T002)** → **Foundational (T003–T004)** must complete first; the route matrix (T003) and gate catalog (T004) block US2/US6/data-exposure.
- **US2, US3, US4, US5, US6 are mutually independent** once Foundational is done — they read disjoint parts of the tree/staging and can run in any order (or in parallel across investigators).
- **US1 (T022–T024) depends on ALL of US2–US6** — it aggregates their findings. It is P1 by value but executes last.
- **Polish (T025–T027)** runs after US1.

## Parallel opportunities

- Within US2: T006, T007, T010 are `[P]` (distinct routes/targets) alongside T005/T008.
- Across stories: after T004, an investigator each on US3 (T011–T012), US4 (T013–T015), US5 (T016–T017), US6 (T018–T021) can proceed concurrently.
- `[P]`-marked: T006, T007, T010, T014, T015, T017, T019, T020.

## MVP scope

The **minimum viable audit** = Foundational + **US2 + US3** (the two P1 investigative stories: authorization and money/credit) + US1 report assembly limited to those findings. That alone answers the highest-risk go/no-go questions (unauthorized data/fund access). US4–US6 harden the verdict and are folded in for the full deliverable.

## Format validation

All 27 tasks use `- [ ] Txxx [P?] [Story?] <description + path>`; Setup/Foundational/Polish carry no story label; US phases carry `[US1]`–`[US6]`; every task names the artifact written (`report.md`/`coverage.md`) and/or the source under review.
