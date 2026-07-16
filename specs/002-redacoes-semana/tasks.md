# Tasks: Argos — Redações da Semana

**Input**: Design documents from `specs/002-redacoes-semana/`

**Organization**: Tasks grouped by user story (US1–US5) in priority order.
Each story is independently testable after its phase is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Maps to spec.md user stories (US1–US5)

---

## Phase 1: Setup

**Purpose**: Scaffold directory structure for new files

- [X] T001 Create directories: `src/modules/weekly/`, `src/app/redacoes-semana/historico/`, `src/app/(admin)/admin/redacoes-semana/`, `src/app/(admin)/admin/metricas/`, `src/app/api/admin/weekly-themes/[id]/content-upload-url/`, `src/app/api/admin/weekly-themes/[id]/contents/[contentId]/`, `src/app/api/admin/metrics/`, `src/app/api/weekly-themes/active/my-entry/`, `src/app/api/weekly-themes/history/`, `tests/unit/weekly/`, `tests/integration/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, migration, middleware, and module skeleton that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add `UserRole` enum (`USER`, `ADMIN`), `WeeklyThemeStatus` enum (`ACTIVE`, `CLOSED`), `WeeklyContentKind` enum (`TEXT`, `FILE`), `FileKind` enum (`IMAGE`, `PDF`), `DisplayAs` enum (`REAL`, `ANONYMOUS`) and `WeeklyTheme`, `WeeklyThemeContent`, `WeeklyThemeEntry` models to `prisma/schema.prisma`; add `role UserRole @default(USER)` field to `User` model; add relation `weeklyEntry WeeklyThemeEntry?` to `Submission`
- [X] T003 Run `npx prisma migrate dev --name add-weekly-themes` and verify migration applies cleanly
- [X] T004 [P] Create `src/middleware.ts`: use Auth.js `getToken()` to protect `/admin` and `/api/admin` paths — redirect unauthenticated requests to `/login` and non-admin sessions to `/` (pages) or return 403 (API routes); leave all other paths unaffected
- [X] T005 [P] Create stub files with exported function signatures (no implementation body) in `src/modules/weekly/`: `theme.ts` (publishTheme, closeTheme, extendTheme, closeExpiredThemes), `ranking.ts` (getLiveRanking, getUserLiveRank, computeAndStoreFinalRanks), `entry.ts` (createEntry, deleteEntry, setDisplayAs, getEntryByUserAndTheme), `metrics.ts` (getThemeMetrics, getAppMetrics), and `index.ts` (re-exports all)

**Checkpoint**: Schema migrated and middleware protecting `/admin`. All module stubs compilable.

---

## Phase 3: User Story 1 — Administrador Publica Tema Semanal (Priority: P1) 🎯 MVP

**Goal**: Admin can publish a weekly theme with support content, and the theme closes
automatically after 7 days. All subsequent features depend on having an active theme.

**Independent Test**: Log in with admin credentials, navigate to `/admin/redacoes-semana`,
create a theme with a text support item and a file upload, verify the theme appears as
active with a 7-day deadline. Then use Prisma to set `endsAt` to a past time and
confirm the instrumentation sweep marks it closed within 60 seconds.

### Implementation for User Story 1

- [X] T006 [P] [US1] Implement `publishTheme(adminId, title, durationDays)`, `closeTheme(themeId)`, `extendTheme(themeId, newEndsAt)`, and `closeExpiredThemes()` in `src/modules/weekly/theme.ts`; enforce single-active-theme invariant in `publishTheme` (throw `ACTIVE_THEME_EXISTS` if one exists) and `closeTheme` (throw `ALREADY_CLOSED` if already closed); `closeExpiredThemes` queries `WeeklyTheme` where `status = ACTIVE AND endsAt <= now()` and calls `closeTheme` for each
- [X] T007 [P] [US1] Create `src/app/(admin)/layout.tsx`: server component that reads the session and redirects to `/` when `session.user.role !== 'ADMIN'`; renders admin nav with links to `/admin/redacoes-semana` and `/admin/metricas`
- [X] T008 [US1] Implement `GET /api/admin/weekly-themes` (list all themes paginated, ordered by `publishedAt DESC`, each with `{id, title, status, publishedAt, endsAt, participantCount}`) and `POST /api/admin/weekly-themes` (body `{title, durationDays?}`, calls `weekly.publishTheme`, returns 201 with created theme) in `src/app/api/admin/weekly-themes/route.ts`
- [X] T009 [US1] Implement `GET /api/admin/weekly-themes/[id]` (theme detail with full content list including signed R2 URLs for files) and `PATCH /api/admin/weekly-themes/[id]` (body `{action: "extend", endsAt: string}` or `{action: "close"}`, calls `weekly.extendTheme` or `weekly.closeTheme`) in `src/app/api/admin/weekly-themes/[id]/route.ts`
- [X] T010 [P] [US1] Implement `POST /api/admin/weekly-themes/[id]/content-upload-url` in `src/app/api/admin/weekly-themes/[id]/content-upload-url/route.ts`: validate `{fileType: "IMAGE"|"PDF", contentType, sizeBytes}` (max 20 MB), create a pending `WeeklyThemeContent` row with `fileKey = weekly-themes/{themeId}/content/{contentId}`, return `{contentId, uploadUrl}` (R2 presigned PUT URL, same pattern as essay image uploads)
- [X] T011 [US1] Implement `POST /api/admin/weekly-themes/[id]/contents` (register a content item after upload: FILE kind confirms the pending row; TEXT kind creates a new row with `body`) and `DELETE /api/admin/weekly-themes/[id]/contents/[contentId]` (deletes row and R2 object if FILE kind) in their respective route files
- [X] T012 [US1] Add weekly theme auto-close interval to `src/instrumentation.ts`: call `weekly.closeExpiredThemes()` every 60 seconds (same pattern as the existing abandoned-submission sweep); log theme IDs closed in each run
- [X] T013 [US1] Update `src/modules/weekly/index.ts` to re-export `publishTheme`, `closeTheme`, `extendTheme`, `closeExpiredThemes` from `theme.ts`
- [X] T014 [US1] Build `src/app/(admin)/admin/redacoes-semana/page.tsx`: server component showing list of all themes (status, deadline, participant count); "Novo Tema" form with `title` field, optional `durationDays` override; support content panel on active theme (add text, upload file with presigned URL flow, delete items); extend/close controls for the active theme

**Checkpoint**: Admin can publish, manage content, extend, and close themes. Auto-close runs every 60 s.

---

## Phase 4: User Story 2 — Aluno Premium Submete Redação (Priority: P2)

**Goal**: A premium subscriber can initiate a submission linked to the active weekly
theme; the entry is unique per user per theme; credit is consumed at confirmation;
anonymity preference is set at confirm time; the entry is cleaned up if the submission
fails or is abandoned.

**Independent Test**: With an active theme published (US1 complete), log in as a premium
user, navigate to `/redacoes-semana`, click "Participar", complete the upload flow
(photo → OCR review → confirm with `weeklyDisplayAs`), verify a `WeeklyThemeEntry` row
exists and links to the new `Submission`, and that the credit balance decreased by 1.
Then attempt a second submission for the same theme and verify it is blocked (409
`ALREADY_ENTERED`).

### Implementation for User Story 2

- [X] T015 [P] [US2] Implement `createEntry(themeId, userId, submissionId)`, `deleteEntry(submissionId)`, `setDisplayAs(submissionId, displayAs)`, and `getEntryByUserAndTheme(themeId, userId)` in `src/modules/weekly/entry.ts`; `createEntry` inserts a `WeeklyThemeEntry` row — Prisma unique constraint on `(themeId, userId)` surfaces as `ALREADY_ENTERED` error
- [X] T016 [US2] Extend `createSubmission()` in `src/modules/submissions/index.ts` to accept optional `weeklyThemeId`; when present: verify `user.subscription.plan.tier === 'premium'` (throw `PREMIUM_REQUIRED`), verify theme is `ACTIVE` (throw `THEME_NOT_ACTIVE`), call `entry.createEntry(themeId, userId, submissionId)` within the same DB transaction that creates the `Submission` row
- [X] T017 [US2] Extend `POST /api/submissions` handler in `src/app/api/submissions/route.ts` to read optional `weeklyThemeId` from request body and forward it to `submissions.createSubmission()`; add `PREMIUM_REQUIRED`, `THEME_NOT_ACTIVE`, and `ALREADY_ENTERED` to the error-code mapping
- [X] T018 [US2] Extend `confirmSubmission()` in `src/modules/submissions/index.ts` to accept optional `weeklyDisplayAs: "real" | "anonymous"`; when the submission has a linked `WeeklyThemeEntry`, this field is required (throw `DISPLAY_AS_REQUIRED` if missing); call `entry.setDisplayAs(submissionId, displayAs)` before starting grading
- [X] T019 [US2] Extend `POST /api/submissions/[id]/confirm` handler in `src/app/api/submissions/[id]/confirm/route.ts` to read optional `weeklyDisplayAs` from body and forward it to `submissions.confirmSubmission()`; add `DISPLAY_AS_REQUIRED` to error mapping
- [X] T020 [US2] Add entry cleanup to submission failure and expiry transitions in `src/modules/submissions/index.ts`: when a submission transitions to `failed` or `expired`, call `entry.deleteEntry(submissionId)` if a `WeeklyThemeEntry` exists for it (freeing the user's slot for potential retry if the theme is still active)
- [X] T021 [US2] Update `src/modules/weekly/index.ts` to re-export `createEntry`, `deleteEntry`, `setDisplayAs`, `getEntryByUserAndTheme` from `entry.ts`
- [X] T022 [US2] Build `src/app/redacoes-semana/page.tsx` as a public server component (no auth redirect): when an active theme exists and the user is authenticated premium without an entry, show "Participar" button (links to `/submissions/new?weeklyThemeId={id}`); when non-premium or unauthenticated, show the theme info with a premium upgrade nudge; always show the ranking section (populated in US3)

**Checkpoint**: Premium users can submit for the active theme through the existing upload flow. Entry uniqueness and cleanup are enforced.

---

## Phase 5: User Story 3 — Qualquer Visitante Visualiza o Ranking Público (Priority: P3)

**Goal**: The public ranking (top 50, with anonymity preferences respected, countdown)
is visible to all visitors including unauthenticated ones.

**Independent Test**: Without logging in, navigate to `/redacoes-semana`; verify the
top-50 ranking loads (or shows an empty state if no evaluated submissions exist), that
the time-remaining countdown is visible, and that entries marked anonymous appear as
"Participante anônimo" with no name.

### Implementation for User Story 3

- [X] T023 [P] [US3] Implement `getLiveRanking(themeId, limit)` (returns ordered list of top-`limit` entries joining `WeeklyThemeEntry → Submission(status=completed) → Evaluation`, sorted by `totalScore DESC, submission.confirmedAt ASC`; masks name to `"Participante anônimo"` when `displayAs = ANONYMOUS`) and `getUserLiveRank(themeId, userId)` (returns user's ordinal position using a count-based subquery: `SELECT COUNT(*)+1 WHERE score > userScore OR (score = userScore AND confirmedAt < userConfirmedAt)`) in `src/modules/weekly/ranking.ts`
- [X] T024 [US3] Implement `GET /api/weekly-themes/active` (no auth required) in `src/app/api/weekly-themes/active/route.ts`: returns `{theme: {id, title, endsAt, contents[]}, ranking: RankingEntry[], participantCount}`; contents include signed R2 URLs for FILE items; 404 `NO_ACTIVE_THEME` when no active theme exists
- [X] T025 [US3] Update `src/modules/weekly/index.ts` to re-export `getLiveRanking`, `getUserLiveRank` from `ranking.ts`
- [X] T026 [US3] Add ranking table (rank, displayName, totalScore, submittedAt) and countdown timer component to `src/app/redacoes-semana/page.tsx`; countdown is a client component that computes `endsAt - now` and updates every second; empty state message when no evaluated submissions exist; anonymous entries display "Participante anônimo"

**Checkpoint**: Unauthenticated visitors can view the ranking and countdown on `/redacoes-semana`.

---

## Phase 6: User Story 4 — Aluno Consulta Histórico de Participação (Priority: P4)

**Goal**: Final ranks are persisted at theme closure; authenticated students can view
their per-theme position history and their live rank on the active theme page.

**Independent Test**: With a closed theme that had evaluated submissions (trigger
auto-close via `endsAt` in the past or via admin panel), log in as a participating
student, navigate to `/redacoes-semana/historico`, verify the closed theme appears with
`finalRank`, total score, and theme title. On the active theme page, verify the user's
own rank card appears below the top-50 table.

### Implementation for User Story 6

- [X] T027 [P] [US4] Implement `computeAndStoreFinalRanks(themeId)` in `src/modules/weekly/ranking.ts`: retrieve all entries with `submission.status = completed` for the theme, sort by `totalScore DESC, submission.confirmedAt ASC`, assign ordinal rank (1-based), bulk-update `WeeklyThemeEntry.finalRank` in a single transaction
- [X] T028 [US4] Extend theme close logic: in `src/modules/weekly/theme.ts`, call `computeAndStoreFinalRanks(themeId)` inside `closeTheme()` after setting `status = CLOSED`; this covers both auto-close (instrumentation sweep) and manual close (admin PATCH endpoint) with a single call site
- [X] T029 [US4] Implement `GET /api/weekly-themes/active/my-entry` (auth required) in `src/app/api/weekly-themes/active/my-entry/route.ts`: returns `{submissionId, submissionStatus, totalScore, rank, totalParticipants, displayAs}`; `rank` is computed via `getUserLiveRank`; `totalScore` is `null` when `submissionStatus` is not `completed`; 404 when user has no entry for the active theme
- [X] T030 [US4] Implement `GET /api/weekly-themes/history` (auth required, paginated with `?page=1`) in `src/app/api/weekly-themes/history/route.ts`: returns entries where `WeeklyThemeEntry.finalRank IS NOT NULL AND userId = session.userId`, joined with `WeeklyTheme` (title, closedAt) and `Evaluation` (totalScore)
- [X] T031 [US4] Build `src/app/redacoes-semana/historico/page.tsx`: server component that requires auth (redirect to `/login` if unauthenticated); fetches `/api/weekly-themes/history`; displays list of past themes with columns: theme title, date closed, score, final rank, total participants
- [X] T032 [US4] Add "Sua posição" card to `src/app/redacoes-semana/page.tsx` for authenticated premium users who have an entry for the active theme: fetches `/api/weekly-themes/active/my-entry` client-side; shows live rank, score, and submission status; hidden for non-participants and unauthenticated visitors

**Checkpoint**: Theme closure persists final ranks. Students see their history at `/redacoes-semana/historico` and their live rank on the theme page.

---

## Phase 7: User Story 5 — Administrador Acompanha Métricas (Priority: P5)

**Goal**: Admin can view per-theme metrics (participants, average score, competency
distribution) and general app metrics (users by plan, total submissions).

**Independent Test**: In the admin panel with a theme that has evaluated submissions,
navigate to `/admin/redacoes-semana`, select a theme and verify participant count,
average score, and C1–C5 score distributions display correctly. Navigate to
`/admin/metricas` and verify user counts by plan and total submission count.

### Implementation for User Story 5

- [X] T033 [P] [US5] Implement `getThemeMetrics(themeId)` (returns `{participantCount, avgTotalScore, scoreDistribution: {c1..c5: Record<string, number>}}` — only counts entries where `submission.status = completed`) and `getAppMetrics()` (returns `{totalUsers, totalSubmissions, usersByPlan}`) in `src/modules/weekly/metrics.ts`
- [X] T034 [US5] Implement `GET /api/admin/weekly-themes/[id]/metrics` in `src/app/api/admin/weekly-themes/[id]/metrics/route.ts`: calls `weekly.getThemeMetrics(id)`, returns the metrics object; 403 for non-admin
- [X] T035 [US5] Implement `GET /api/admin/metrics` in `src/app/api/admin/metrics/route.ts`: calls `weekly.getAppMetrics()`, returns `{totalUsers, totalSubmissions, usersByPlan}`; 403 for non-admin
- [X] T036 [US5] Update `src/modules/weekly/index.ts` to re-export `getThemeMetrics`, `getAppMetrics` from `metrics.ts`
- [X] T037 [US5] Build `src/app/(admin)/admin/metricas/page.tsx`: server component (admin only via layout); fetches `/api/admin/metrics`; displays total users, total submissions, and a breakdown of users per plan (free/entry/premium) with counts
- [X] T038 [US5] Add per-theme metrics panel to `src/app/(admin)/admin/redacoes-semana/page.tsx`: for each theme in the list, show a collapsible metrics section fetching `/api/admin/weekly-themes/{id}/metrics`; display participantCount, avgTotalScore, and a simple distribution table per competency (C1–C5 with counts per score bucket)

**Checkpoint**: Admin can monitor participation and app health from the `/admin` panel.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Tests required by the project constitution, navigation wiring, and validation.

- [X] T039 [P] Write unit tests for theme lifecycle in `tests/unit/weekly/theme.test.ts`: `publishTheme` rejects when a theme is already active; `closeTheme` rejects on already-closed theme; `extendTheme` updates `endsAt`; `closeExpiredThemes` closes only past-deadline themes
- [X] T040 [P] Write unit tests for entry lifecycle in `tests/unit/weekly/entry.test.ts`: `createEntry` inserts correctly; second call for same `(themeId, userId)` throws `ALREADY_ENTERED`; `deleteEntry` removes the row; `setDisplayAs` updates `displayAs`
- [X] T041 [P] Write unit tests for ranking in `tests/unit/weekly/ranking.test.ts`: `getLiveRanking` orders by totalScore DESC then confirmedAt ASC; ties broken by earlier confirmation; anonymous entries have masked display name; `computeAndStoreFinalRanks` assigns correct ordinal ranks and handles ties deterministically
- [X] T042 Write integration test for the admin weekly theme CRUD flow in `tests/integration/weekly-admin.test.ts`: create theme via POST, verify 409 on second publish, PATCH extend, PATCH close, verify 409 on modify-after-close
- [X] T043 [P] Add "Redações da Semana" link to the authenticated app navigation (wherever the existing sidebar/header component lives); add "Histórico" sub-link pointing to `/redacoes-semana/historico`
- [X] T044 Validate the full dev flow per `specs/002-redacoes-semana/quickstart.md`: apply migration, promote admin, publish theme via admin panel, submit as premium user, verify ranking, trigger manual close, verify finalRank in database

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories (T003 and T004 can run in parallel within this phase after T002 completes)
- **Phase 3–7 (User Stories)**: All depend on Phase 2 completion; within that constraint:
  - US1 (Phase 3): No story dependencies — start first
  - US2 (Phase 4): Soft dependency on US1 (needs an active theme for integration testing)
  - US3 (Phase 5): Can start after US1 (API + ranking module are independent of US2; UI builds on US2's page)
  - US4 (Phase 6): Depends on US1 (`closeTheme` extended) and US2 (entries needed for finalRank)
  - US5 (Phase 7): Independent after Phase 2; metrics queries don't depend on other stories
- **Phase 8 (Polish)**: After all desired stories are complete

### User Story Dependencies

| Story | Can start after | Blocks |
|---|---|---|
| US1 (Admin Publica) | Phase 2 | US2, US3, US4 (soft) |
| US2 (Aluno Submete) | Phase 2 + US1 live | US4 (finalRank needs entries) |
| US3 (Ranking Público) | Phase 2 + US1 live | — |
| US4 (Histórico) | US1 + US2 complete | — |
| US5 (Métricas Admin) | Phase 2 | — |

### Parallel Opportunities Within Each Story

**Phase 2**: T003 and T004 run in parallel (after T002)

**Phase 3 (US1)**: T006 and T007 run in parallel; T010 runs in parallel with T008/T009

**Phase 4 (US2)**: T015 runs in parallel with T016

**Phase 5 (US3)**: T023 runs in parallel with T024

**Phase 6 (US4)**: T027 runs in parallel with T029/T030

**Phase 7 (US5)**: T033 runs in parallel with T034/T035

**Phase 8**: T039, T040, T041, T043 all run in parallel

---

## Parallel Execution Examples

### Phase 3 (US1) — parallel start

```
Parallel:
  Task T006: "Implement publishTheme, closeTheme, extendTheme, closeExpiredThemes in src/modules/weekly/theme.ts"
  Task T007: "Create admin layout with role guard in src/app/(admin)/layout.tsx"

Then sequential: T008 → T009 → T010+T011 (T010 parallel with T011) → T012 → T013 → T014
```

### Phase 8 (Polish) — parallel tests

```
Parallel:
  Task T039: "Unit tests for theme lifecycle in tests/unit/weekly/theme.test.ts"
  Task T040: "Unit tests for entry lifecycle in tests/unit/weekly/entry.test.ts"
  Task T041: "Unit tests for ranking in tests/unit/weekly/ranking.test.ts"
  Task T043: "Add nav links to authenticated app navigation"
```

---

## Implementation Strategy

### MVP First (US1 Only → publish/close admin flow)

1. Complete Phase 1 + Phase 2
2. Complete Phase 3 (US1) → admin can publish and manage themes
3. **STOP and VALIDATE**: admin panel works, auto-close fires
4. US1 alone is deployable as a foundation

### Incremental Delivery

1. Setup + Foundational (Phase 1–2) → deploy-ready base
2. US1 → admin can publish themes (deploy, demo admin panel)
3. US2 → premium students can submit (deploy, test with real users)
4. US3 → public ranking visible (deploy, opens feature to all visitors)
5. US4 → students see history and own rank (deploy, full student experience)
6. US5 → admin has metrics dashboard (deploy, operational visibility)

---

## Notes

- `[P]` tasks operate on different files and have no unresolved dependencies on other in-progress tasks
- `[Story]` label enables tracing each task to its user story for independent validation
- The page `src/app/redacoes-semana/page.tsx` is built outside `(app)/` route group intentionally — it must be publicly accessible to unauthenticated visitors (ranking is public per spec FR-015); the history page at `src/app/redacoes-semana/historico/page.tsx` handles its own auth check
- `computeAndStoreFinalRanks` is called inside `closeTheme` (single call site) — covers both auto-close and manual admin close without duplication
- Unit tests (T039–T041) are required by the project constitution: "Funcionalidade nova DEVE vir acompanhada de testes que cubram o comportamento público do módulo afetado"
- Commit after each phase checkpoint to keep history clean and reversible

## Implementation Notes (deviations from the original task plan)

- **T004 — admin guard instead of Edge middleware**: The codebase's auth (`src/lib/auth.ts`)
  imports Prisma/bcrypt and cannot run in the Next.js Edge runtime; splitting the auth
  config to enable middleware would be a risky refactor for a single gate. Implemented as
  a DB-backed `requireAdmin()` guard (consistent with the existing `requireUser`/
  `requireVerifiedUser` pattern) used by every `/api/admin/*` route, plus a server-side
  role check in the `(admin)/layout.tsx` route group. Same outcome (403/redirect for
  non-admins), simpler and consistent (Constitution II/IV). No `src/middleware.ts` created.
- **Enum values use the existing snake_case lowercase convention** (`active`, `closed`,
  `text`, `file`, `real`, `anonymous`) to match the existing schema, not the UPPERCASE in
  the original data-model draft.
- **Storage**: added `presignDownload` to the `StorageAdapter` interface (R2 + Fake) and a
  GET handler to the fake-upload route so support files render under `FAKE_VENDORS=1`.
- **Premium check** lives in the billing module (`getActiveTier`) — billing owns
  subscription state; the submissions module calls through its public interface.
- **Grading-failure cleanup**: `grading.failSubmission` calls `weekly.deleteEntry`,
  mirroring how it already calls `credits.refundCredit` (established cross-module pattern).
- Validation: `tsc --noEmit` clean, `eslint` clean, 94/94 tests passing, `next build` OK.
