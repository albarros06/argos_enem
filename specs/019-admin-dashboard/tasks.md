---

description: "Task list for Admin Dashboard Overhaul"
---

# Tasks: Admin Dashboard Overhaul

**Input**: Design documents from `/specs/019-admin-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: INCLUDED — the constitution mandates tests covering the public behavior of every
affected module, and this feature adds one new module (`admin`) plus changes a shared one
(`credits`).

**Organization**: Grouped by user story (US1–US5 from spec.md) for independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 / US4 / US5 (Setup, Foundational, Polish have no story label)

## Path Conventions

Single Next.js web app. New module in `src/modules/admin/`; pages in
`src/app/(admin)/admin/`; the one new API route in `src/app/api/admin/`; tests in
`tests/unit/admin/` and `tests/integration/`.

---

## Phase 1: Setup

**Purpose**: Add the one new persisted entity this feature needs.

- [ ] T001 Add `AdminActionType` enum, `AdminActionLog` model, and the two back-relations
      (`adminActionsPerformed`, `adminActionsReceived`) on `User` to `prisma/schema.prisma`,
      per `data-model.md`.
- [ ] T002 Run `npx prisma migrate dev --name admin_action_log` to generate and apply the
      migration and regenerate the Prisma client.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The audit-log read/write primitive both P1 stories build on, and the module's
public-export barrel.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 [P] Implement `src/modules/admin/auditLog.ts`: `recordAdminAction(adminId,
      action, targetUserId, amount, reason)` and `listActionsForUser(targetUserId)`, per
      `data-model.md`'s `AdminActionLog`.
- [ ] T004 [P] Unit tests for `auditLog.ts` in `tests/unit/admin/auditLog.test.ts`: record
      then list returns the entry with the correct fields; `listActionsForUser` on a user
      with no actions returns an empty array.
- [ ] T005 Create `src/modules/admin/index.ts` as the module's public-export barrel,
      exporting `recordAdminAction`/`listActionsForUser` to start (each story below adds
      its own exports here).

**Checkpoint**: `admin` module compiles; audit-log read/write path is tested and ready for
US2 to call and US1 to display.

---

## Phase 3: User Story 1 - Find a user and see their full history (Priority: P1) 🎯 MVP (1/2)

**Goal**: Search a user by email and see their submissions, credit history, subscription,
verification status, and audit history on one page.

**Independent Test**: Search a known user's email, confirm the detail page's data matches
what a direct database query would show.

### Tests for User Story 1

- [ ] T006 [P] [US1] Unit tests for `searchUsers()` in `tests/unit/admin/search.test.ts`:
      exact-email match, partial case-insensitive match, result cap at 20, excludes
      soft-deleted (`deletedAt` set) users, empty query returns no results.
- [ ] T007 [P] [US1] Unit tests for `getUserDetail()` in `tests/unit/admin/userDetail.test.ts`:
      full shape for a user with submissions/credits/subscription; empty-state shape
      (`submissions: []`, `subscription: null`) for a fresh user; includes `auditHistory`
      (empty for a user with no admin actions yet); returns `null` for an unknown or
      soft-deleted id.
- [ ] T008 [P] [US1] Integration test for the search → detail flow in
      `tests/integration/admin-dashboard.test.ts`: seed a user with a submission +
      evaluation + credit transaction, call `searchUsers`/`getUserDetail`, assert the
      returned data matches the seed.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Implement `searchUsers(query)` in `src/modules/admin/search.ts`
      (case-insensitive `contains` on `email`, `deletedAt: null`, `take: 20`).
- [ ] T010 [P] [US1] Implement `getUserDetail(userId)` in `src/modules/admin/userDetail.ts`:
      submissions (theme/status/score/date) via `Submission` ⋈ `Evaluation`, `creditBalance`
      via `credits.getBalance`, `creditTransactions` list, `subscription` via `Subscription`
      ⋈ `SubscriptionPlan`, verification status, `auditHistory` via
      `auditLog.listActionsForUser`. Returns `null` when the user doesn't exist or is
      soft-deleted (contracts/api.md).
- [ ] T011 [US1] Export `searchUsers` and `getUserDetail` from `src/modules/admin/index.ts`.
      (depends on T009, T010)
- [ ] T012 [US1] Create `src/app/(admin)/admin/usuarios/page.tsx` (server component): reads
      the `?q=` search param, calls `searchUsers`, renders an empty state when `q` is blank
      and a "no user found" state when it matches nothing, otherwise a result list linking
      to `/admin/usuarios/{id}`. (depends on T011)
- [ ] T013 [P] [US1] Create `src/app/(admin)/admin/usuarios/UserSearch.tsx` (client
      component): search input that pushes `?q=` via `useRouter`, mirroring the pattern in
      `AdminThemes.tsx`.
- [ ] T014 [US1] Create `src/app/(admin)/admin/usuarios/[id]/page.tsx` (server component):
      calls `getUserDetail(id)`, `notFound()` when null, renders the submissions / credits /
      subscription / verification / audit-history sections with empty states per the spec's
      edge cases. (depends on T010)
- [ ] T015 [US1] Update `src/app/(admin)/layout.tsx` nav: add a "Usuários" link to
      `/admin/usuarios`.

**Checkpoint**: User Story 1 is fully functional and testable independently — an admin can
search for and inspect any user's full history end to end.

---

## Phase 4: User Story 2 - Grant a credit adjustment with an audit trail (Priority: P1) 🎯 MVP (2/2)

**Goal**: From a user's detail page, grant or deduct credits; the action is recorded with
actor, target, amount, reason, and timestamp.

**Independent Test**: Grant a credit adjustment to a test user from their detail page,
confirm the balance updates immediately, and confirm an audit-log entry exists.

### Tests for User Story 2

- [ ] T016 [P] [US2] Update `tests/unit/credits.test.ts`: `grantManualCredits` accepts a
      negative amount and records it correctly; still rejects `0` and non-integer amounts.
- [ ] T017 [P] [US2] Unit tests for `grantCreditAdjustment()` in
      `tests/unit/admin/credits.test.ts`: a positive grant updates the balance and writes
      one `AdminActionLog` row; a negative deduction does the same with a negative amount;
      `amount === 0` and an empty/whitespace `reason` are both rejected without writing
      anything to either table (transactional — spec edge case).

### Implementation for User Story 2

- [ ] T018 [US2] Widen the guard in `grantManualCredits` (`src/modules/credits/index.ts`) to
      accept negative integers, rejecting only `amount === 0` or non-integer values; update
      its doc comment per `research.md`.
- [ ] T019 [US2] Implement `grantCreditAdjustment(adminId, targetUserId, amount, reason)` in
      `src/modules/admin/credits.ts`: validate per `data-model.md`'s Validation rules, then
      in one `prisma.$transaction` call `credits.grantManualCredits` +
      `auditLog.recordAdminAction`; return the updated balance and the audit entry.
      (depends on T003, T018)
- [ ] T020 [US2] Export `grantCreditAdjustment` from `src/modules/admin/index.ts`. (depends
      on T019)
- [ ] T021 [US2] Implement `POST /api/admin/usuarios/[id]/credits` in
      `src/app/api/admin/usuarios/[id]/credits/route.ts`: `requireAdmin()`, Zod-validate
      `{amount, reason}` (contracts/api.md), 404 `NOT_FOUND` if the target doesn't exist,
      call `grantCreditAdjustment`, return `{balance, auditEntry}`. (depends on T020)
- [ ] T022 [P] [US2] Integration test for the credit-grant route in
      `tests/integration/admin-dashboard.test.ts`: a valid grant returns 200 with the
      updated balance and creates an `AdminActionLog` row; `amount: 0` returns 400
      `VALIDATION_ERROR` with no new ledger/audit rows; a non-admin session gets 403.
- [ ] T023 [US2] Create `src/app/(admin)/admin/usuarios/[id]/CreditGrantForm.tsx` (client
      component): amount + reason inputs, posts to the new route, `router.refresh()` on
      success, surfaces validation errors (mirrors `AdminThemes.tsx`'s `readError` helper).
- [ ] T024 [US2] Wire `CreditGrantForm` and the (already-present) `auditHistory` list into
      `src/app/(admin)/admin/usuarios/[id]/page.tsx`. (depends on T014, T023)

**Checkpoint**: User Stories 1 and 2 together deliver the full search → inspect → grant →
audit workflow — this is the feature's real MVP.

---

## Phase 5: User Story 3 - Revenue and subscription health (Priority: P2)

**Goal**: MRR estimate, subscriber counts by plan tier and status, and a recent-payments
feed.

**Independent Test**: View the revenue section; confirm MRR and per-tier counts match a
manual count of `active` subscriptions × plan price.

### Tests for User Story 3

- [ ] T025 [P] [US3] Unit tests for `getRevenueSummary()` in
      `tests/unit/admin/revenue.test.ts`: MRR sums only `active`-status subscriptions at
      their plan's price; subscriber counts broken down correctly by tier and status;
      recent-payments feed ordered newest-first and capped at 20; zero-subscriptions state
      returns zeros/empty arrays, not an error.

### Implementation for User Story 3

- [ ] T026 [US3] Implement `getRevenueSummary()` in `src/modules/admin/revenue.ts`, per
      `data-model.md`'s `RevenueSummary`.
- [ ] T027 [US3] Export `getRevenueSummary` from `src/modules/admin/index.ts`. (depends on
      T026)
- [ ] T028 [US3] Create `src/app/(admin)/admin/page.tsx` as the new overview (server
      component), replacing the old redirect to `/admin/redacoes-semana`: render MRR,
      subscriber-by-tier/status, and recent-payments cards from `getRevenueSummary()`.
      (depends on T026)
- [ ] T029 [US3] Update `src/app/(admin)/layout.tsx` nav: add a "Painel" link to `/admin`.
      (depends on T015 — same file)

**Checkpoint**: User Stories 1–3 are all independently functional; the admin overview now
shows real revenue data.

---

## Phase 6: User Story 4 - Submission pipeline and grading health (Priority: P3)

**Goal**: Submission counts by status, failure/zero-reason breakdowns, and score
distribution.

**Independent Test**: View the pipeline section; confirm status counts match a direct
grouped count of submissions.

### Tests for User Story 4

- [ ] T030 [P] [US4] Unit tests for `getPipelineHealth()` in
      `tests/unit/admin/pipeline.test.ts`: all 7 `SubmissionStatus` values present
      (including zero-count ones); failure-reason and zero-reason breakdowns correct;
      score-distribution buckets (width 100) computed only over `completed` submissions'
      evaluations.

### Implementation for User Story 4

- [ ] T031 [US4] Implement `getPipelineHealth()` in `src/modules/admin/pipeline.ts`, per
      `data-model.md`'s `PipelineHealth`.
- [ ] T032 [US4] Export `getPipelineHealth` from `src/modules/admin/index.ts`. (depends on
      T031)
- [ ] T033 [US4] Extend `src/app/(admin)/admin/page.tsx` with a pipeline-health section
      (status counts, failure/zero-reason breakdown, score-distribution histogram) from
      `getPipelineHealth()`. (depends on T028, T031)

**Checkpoint**: User Stories 1–4 are all independently functional; the overview also
surfaces pipeline health.

---

## Phase 7: User Story 5 - Growth and activity snapshot (Priority: P4)

**Goal**: 24h/7d/30d/all-time counts for signups, submissions, and verifications; retires
the old bare metrics page it supersedes.

**Independent Test**: View the growth section; confirm counts match direct windowed counts
of the underlying records.

### Tests for User Story 5

- [ ] T034 [P] [US5] Unit tests for `getGrowthSnapshot()` in
      `tests/unit/admin/growth.test.ts`: correct counts per window (24h/7d/30d/all-time) for
      signups, submissions, and verifications; all-time totals match what the retired
      `getAppMetrics` used to return.

### Implementation for User Story 5

- [ ] T035 [US5] Implement `getGrowthSnapshot()` in `src/modules/admin/growth.ts`, per
      `data-model.md`'s `GrowthSnapshot`.
- [ ] T036 [US5] Export `getGrowthSnapshot` from `src/modules/admin/index.ts`. (depends on
      T035)
- [ ] T037 [US5] Extend `src/app/(admin)/admin/page.tsx` with a growth-snapshot section
      (24h/7d/30d/all-time cards) from `getGrowthSnapshot()`. (depends on T028, T035)
- [ ] T038 [US5] Delete `getAppMetrics` from `src/modules/weekly/metrics.ts` and its export
      from `src/modules/weekly/index.ts`; delete `src/app/api/admin/metrics/route.ts`.
      (depends on T037 — the overview must cover its data first)
- [ ] T039 [US5] Change `src/app/(admin)/admin/metricas/page.tsx` to redirect to `/admin`
      (contracts/api.md — "Removed Endpoint"). (depends on T038)
- [ ] T040 [US5] Update `src/app/(admin)/layout.tsx` nav: remove the old "Métricas" link.
      (depends on T029 — same file)
- [ ] T041 [P] [US5] Check `tests/integration/weekly-admin.test.ts` for assertions against
      the now-deleted `getAppMetrics`/`GET /api/admin/metrics`; remove any that exist.

**Checkpoint**: All five user stories are independently functional — the new dashboard
fully replaces the old two-page admin panel.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup that spans the whole feature, deferred until every story lands.

- [ ] T042 [P] Run `pnpm lint` and `pnpm format:check`; fix any violations in the new/changed
      files.
- [ ] T043 Delete `scripts/add-credits.ts` now that US2's dashboard action supersedes it —
      confirm with the user before removing (quickstart.md).
- [ ] T044 Walk through `specs/019-admin-dashboard/quickstart.md`'s manual verification pass
      (all 5 priorities) against local dev with a real admin session.
- [ ] T045 Run the full `pnpm test` suite to confirm no regressions in the existing
      `weekly`/`credits` tests from the `grantManualCredits` and `getAppMetrics` changes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (needs the `AdminActionLog` table) — BLOCKS
  User Stories 1 and 2.
- **User Story 1 (Phase 3)**: Depends on Foundational (reads `auditHistory` via
  `auditLog.listActionsForUser`, even though it's always empty until US2 exists).
- **User Story 2 (Phase 4)**: Depends on User Story 1 (writes happen via the same
  `/admin/usuarios/[id]` page US1 creates; T024 edits the page T014 created).
- **User Story 3 (Phase 5)**: Depends on Foundational only; independent of US1/US2's files
  except the shared `layout.tsx` nav (T029 follows T015 in that one file).
- **User Story 4 (Phase 6)**: Depends on User Story 3 (extends the `admin/page.tsx` overview
  US3 creates in T028).
- **User Story 5 (Phase 7)**: Depends on User Story 3 (same reason as US4) and functionally
  supersedes the old metrics page/route once its own data is in place.
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### User Story Dependencies (Summary)

- US1 and US2 are the two P1 stories and, together, the MVP — US2 is not independently
  deployable before US1 since it extends US1's page, but US1 is fully shippable alone.
- US3 is independent of US1/US2 (different module files, different page) and can be built
  in parallel with them once Foundational is done.
- US4 and US5 both extend the overview page US3 introduces, so they're sequenced after US3,
  but are independent of each other's *module* files (`pipeline.ts` vs `growth.ts`) — only
  their shared edits to `admin/page.tsx` need sequencing (not marked `[P]` for that reason).

### Parallel Opportunities

- T003 and T004 (Foundational) can run in parallel.
- Within US1: T006–T008 (tests) in parallel; T009–T010 (module implementations) in
  parallel; T013 in parallel with T012/T014.
- Within US2: T016–T017 (tests) in parallel; T022 in parallel with T023 once T021 lands.
- Once Foundational is done, US1 and US3 can be staffed in parallel (different files); US2
  waits on US1's page; US4/US5 wait on US3's page.

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Unit tests for searchUsers() in tests/unit/admin/search.test.ts"
Task: "Unit tests for getUserDetail() in tests/unit/admin/userDetail.test.ts"
Task: "Integration test for search -> detail flow in tests/integration/admin-dashboard.test.ts"

# Module implementations together:
Task: "Implement searchUsers(query) in src/modules/admin/search.ts"
Task: "Implement getUserDetail(userId) in src/modules/admin/userDetail.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks both P1 stories).
3. Complete Phase 3: User Story 1 — **stop and validate** independently (search + detail
   render correctly).
4. Complete Phase 4: User Story 2 — **stop and validate**: grant/deduct + audit entry.
5. This is the MVP: the manual-DB-query and manual-script workflows this feature exists to
   replace are now fully covered. Deploy/demo here if ready.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → validate → optionally ship (support lookups already work, no write action yet).
3. US2 → validate → ship (MVP complete: search, inspect, grant, audit).
4. US3 → validate → ship (revenue visibility added; overview page now exists).
5. US4 → validate → ship (pipeline health added to the overview).
6. US5 → validate → ship (growth snapshot added; old metrics page/route/module code
   retired — this is the point the overhaul is fully "done").
7. Polish.

---

## Notes

- [P] tasks touch different files with no unfinished dependency between them.
- [Story] labels map every implementation task to its user story for traceability.
- Tests are included per the constitution's testing requirement — write them before the
  matching implementation task and confirm they fail first.
- T015/T029/T040 all touch `src/app/(admin)/layout.tsx` — sequential by story order, not
  parallel, even though each is a small isolated edit.
- T028/T033/T037 all touch `src/app/(admin)/admin/page.tsx` — same reasoning.
