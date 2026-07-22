---
description: "Task list for Argos — Grupos de Alunos"
---

# Tasks: Argos — Grupos de Alunos

**Input**: Design documents from `/specs/009-student-groups/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: INCLUDED — the project constitution (Restrições e Padrões de Qualidade) requires
new functionality to ship with tests covering the affected module's public behavior. Tests
use Vitest (`tests/unit`, `tests/integration`), with vendor calls faked via `FAKE_VENDORS`
where the grading pipeline is exercised.

**Organization**: Tasks are grouped by user story (US1 → US4, priority order from spec.md)
for independent implementation and testing. MVP = User Story 1. US2 and US3 share priority
P2 in spec.md but are sequentially dependent (a theme must exist before a member can submit
against it), so US2 is built first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 / US4 (Setup, Foundational, Polish have no story label)

## Path Conventions

Single Next.js web app. Source under `src/` (`src/app`, `src/modules`), tests under
`tests/` (`unit`, `integration`).

---

## Phase 1: Setup

**Purpose**: Scaffold directories for the new module, routes, and tests.

- [X] T001 Create directories: `src/modules/groups/`, `src/app/(app)/groups/join/[code]/`, `src/app/(app)/groups/[id]/`, `src/app/api/groups/join/`, `src/app/api/groups/[id]/invite/`, `src/app/api/groups/[id]/members/[userId]/`, `src/app/api/groups/[id]/themes/[themeId]/content-upload-url/`, `src/app/api/groups/[id]/themes/[themeId]/contents/[contentId]/`, `tests/unit/groups/`

**Checkpoint**: Directory layout ready for module, route, and test files.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, migration, and module skeleton that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add enums `GroupThemeStatus` (`active`, `closed`), `GroupContentKind` (`text`, `file`), `GroupFileKind` (`image`, `pdf`), `GroupDisplayAs` (`real`, `anonymous`); models `Group` (`leaderId String?` with `onDelete: SetNull`, `inviteCode` unique), `GroupMember` (`@@unique([groupId, userId])`, both FKs `onDelete: Cascade`), `GroupTheme` (`groupId`, `title`, `status`, `publishedAt`, `closedAt`, `onDelete: Cascade` on `groupId`), `GroupThemeContent` (mirrors `WeeklyThemeContent` shape), `GroupThemeEntry` (mirrors `WeeklyThemeEntry` shape, `@@unique([themeId, userId])`, `submissionId` unique) to `prisma/schema.prisma`; add inverse relations `ledGroups`, `groupMemberships`, `groupThemeEntries` to `User` and `groupEntry` to `Submission`
- [X] T003 Run `npx prisma migrate dev --name add_student_groups` and verify it applies cleanly — DEVIATION: run with `DATABASE_URL`/`DIRECT_URL` overridden to the local dev Postgres (`docker compose up -d postgres`, port 5434), not the committed `.env` (which points at the production Supabase instance) — the generated migration (`prisma/migrations/20260722201615_add_student_groups/`) is applied to the test DB automatically by `tests/globalSetup.ts`. Also added the 5 new tables to the `TRUNCATE` list in `tests/helpers.ts` `resetDb()`, matching the existing `Weekly*` entries — required for test isolation, not a schema change.
- [X] T004 [P] Create stub files with exported function signatures (no implementation body) in `src/modules/groups/`: `group.ts` (createGroup, joinGroup, listForUser, requireGroupMember, requireGroupLeader, removeMember, regenerateInvite, deleteGroup), `theme.ts` (proposeTheme, closeTheme), `content.ts` (presignContentUpload, addContent, deleteContent, getThemeContents), `entry.ts` (createEntry, deleteEntry, setDisplayAs, getEntryByUserAndTheme, getEntryBySubmission), `ranking.ts` (getLiveRanking, computeAndStoreFinalRanks), `views.ts` (getGroupDetailView), and `index.ts` (re-exports all)

**Checkpoint**: Schema migrated; all module stubs compile.

---

## Phase 3: User Story 1 — Aluno Cria um Grupo e Convida Colegas (Priority: P1) 🎯 MVP

**Goal**: Any student can create a group (becoming leader), share an invite code/link, and
have other students join up to the 30-participant cap (5-group cap as a member).

**Independent Test**: Create a group with account A, copy the invite code, join with
account B, and confirm B appears in the group's member list; confirm a 31st join and a 6th
membership (for a student already in 5 groups) are both rejected.

### Tests for User Story 1

- [X] T005 [P] [US1] Unit test: `joinGroup` rejects at 30 participants (leader + 29 members) with `GROUP_FULL`, rejects a 6th membership with `MEMBER_GROUP_LIMIT` (leading groups doesn't count), and is a no-op success if the user already belongs to the group — in `tests/unit/groups/group.test.ts`
- [X] T006 [P] [US1] Integration test: `POST /api/groups` returns the group with the caller as leader and an `inviteCode`; `POST /api/groups/join` with that code adds a `GroupMember` row; an invalid code returns `INVITE_NOT_FOUND` — in `tests/integration/groups.test.ts`

### Implementation for User Story 1

- [X] T007 [US1] Implement `createGroup(userId, name)`, `joinGroup(userId, inviteCode)` (enforcing `GROUP_FULL`, `MEMBER_GROUP_LIMIT`, `INVITE_NOT_FOUND`, idempotent re-join), `listForUser(userId)`, and `requireGroupMember(groupId, userId)` in `src/modules/groups/group.ts`; invite codes generated with `crypto.randomBytes(9).toString("base64url")`
- [X] T008 [US1] Update `src/modules/groups/index.ts` to re-export `createGroup`, `joinGroup`, `listForUser`, `requireGroupMember` from `group.ts` (depends on T007)
- [X] T009 [P] [US1] Implement `GET /api/groups` (list caller's groups with `role`, `memberCount`, `hasActiveTheme: false` for now) and `POST /api/groups` (body `{name}`, calls `groups.createGroup`, 201) in `src/app/api/groups/route.ts`
- [X] T010 [P] [US1] Implement `POST /api/groups/join` (body `{inviteCode}`, calls `groups.joinGroup`) in `src/app/api/groups/join/route.ts`
- [X] T011 [US1] Implement `GET /api/groups/{id}` (group info, `leaderName`, members list; 403 `NOT_GROUP_MEMBER` via `requireGroupMember`) in `src/app/api/groups/[id]/route.ts`
- [X] T012 [P] [US1] Build `src/app/(app)/groups/page.tsx`: list of groups led/joined (role, member count) and a "Criar grupo" form (name)
- [X] T013 [P] [US1] Build `src/app/(app)/groups/join/[code]/page.tsx`: calls the join API with the URL's code and redirects to the group detail page on success, or shows the `INVITE_NOT_FOUND`/cap-exceeded message
- [X] T014 [P] [US1] Build `src/app/(app)/groups/[id]/page.tsx`: group name, invite code/link (copyable), members list
- [X] T015 [P] [US1] Fill the reserved 4th slot in `src/app/(app)/BottomTabBar.tsx` with `{ href: "/groups", label: "Grupos" }`

**Checkpoint**: Group creation, invites, joining, and caps are fully functional and
independently testable (MVP).

---

## Phase 4: User Story 2 — Líder Propõe um Tema para o Grupo (Priority: P2)

**Goal**: The group's leader proposes one essay theme at a time, with optional text/file
support content, and can close it manually.

**Independent Test**: As the leader of an existing group, propose a theme with a text
support item and an uploaded file; confirm it's visible to members. Attempt a second
proposal while the first is active and confirm it's rejected. Close the theme and confirm
its status updates.

### Tests for User Story 2

- [X] T016 [P] [US2] Unit test: `proposeTheme` rejects a second active theme with `ACTIVE_THEME_EXISTS`; a non-leader calling `proposeTheme`/`closeTheme` is rejected via `requireGroupLeader` with `NOT_GROUP_LEADER`; `closeTheme` rejects an already-closed theme with `ALREADY_CLOSED` — in `tests/unit/groups/theme.test.ts`
- [X] T017 [P] [US2] Integration test: leader proposes a theme with one text content and one uploaded file → theme active, `getThemeContents` returns both with a signed file URL; leader closes it → status `closed`, `closedAt` set — in `tests/integration/groups.test.ts`

### Implementation for User Story 2

- [X] T018 [US2] Implement `requireGroupLeader(groupId, userId)` in `src/modules/groups/group.ts`, and `proposeTheme(groupId, leaderId, title)` / `closeTheme(groupId, leaderId, themeId)` in `src/modules/groups/theme.ts` (mirrors `weekly/theme.ts` minus deadline/auto-close logic; `closeTheme` calls `ranking.computeAndStoreFinalRanks`, whose signature already exists from the Phase 2 stub)
- [X] T019 [P] [US2] Implement `presignContentUpload`, `addContent`, `deleteContent`, `getThemeContents` in `src/modules/groups/content.ts` (mirrors `weekly/content.ts`; R2 key prefix `group-themes/{themeId}/content/{id}`; same 20 MB limit)
- [X] T020 [P] [US2] Implement `getLiveRanking(themeId)` and `computeAndStoreFinalRanks(themeId)` in `src/modules/groups/ranking.ts` (mirrors `weekly/ranking.ts`; no top-N truncation needed — group is capped at 30 participants by construction)
- [X] T021 [US2] Update `src/modules/groups/index.ts` to re-export `proposeTheme`, `closeTheme`, `requireGroupLeader` from `theme.ts`/`group.ts`, and the `content.ts`/`ranking.ts` functions (depends on T018–T020)
- [X] T022 [US2] Implement `POST /api/groups/{id}/themes` (propose) in `src/app/api/groups/[id]/themes/route.ts` and `PATCH /api/groups/{id}/themes/{themeId}` (body `{action:"close"}`) in `src/app/api/groups/[id]/themes/[themeId]/route.ts`
- [X] T023 [P] [US2] Implement `POST /api/groups/{id}/themes/{themeId}/content-upload-url` in `src/app/api/groups/[id]/themes/[themeId]/content-upload-url/route.ts`
- [X] T024 [US2] Implement `POST /api/groups/{id}/themes/{themeId}/contents` and `DELETE /api/groups/{id}/themes/{themeId}/contents/{contentId}` in `src/app/api/groups/[id]/themes/[themeId]/contents/route.ts` and `.../contents/[contentId]/route.ts`
- [X] T025 [US2] Extend `GET /api/groups/{id}` (`src/app/api/groups/[id]/route.ts`) to include `activeTheme` (with contents) when one exists
- [X] T026 [US2] Extend `src/app/(app)/groups/[id]/page.tsx`: active-theme section (enunciado + support content); leader-only "Propor tema" (title, optional text/file content) and "Encerrar tema" controls

**Checkpoint**: Leader can propose, illustrate, and close a group theme; visible to all
members. US1 unaffected.

---

## Phase 5: User Story 3 — Membro Submete Redação e Vê o Ranking (Priority: P2)

**Goal**: A group member submits an essay against the group's active theme through the
existing submission flow (no extra plan/credit gate) and sees the group-only ranking.

**Independent Test**: As a member of a group with an active theme, submit an essay via the
existing upload flow, choosing real-name or anonymous display; after evaluation, confirm the
result appears correctly ordered in the group's ranking, and that a second submission to the
same theme is rejected.

### Tests for User Story 3

- [X] T027 [P] [US3] Unit test: `createSubmission` with `groupThemeId` rejects a non-member with `NOT_GROUP_MEMBER`, an inactive/nonexistent theme with `THEME_NOT_ACTIVE`, a duplicate entry with `ALREADY_ENTERED`, and both `weeklyThemeId` + `groupThemeId` present with `VALIDATION_ERROR`; confirms no subscription-tier check runs on this branch — in `tests/unit/groups/entry.test.ts`
- [X] T028 [P] [US3] Integration test: full submit → confirm with `groupDisplayAs` → (fake) evaluation completes → entry appears in `GET /api/groups/{id}` ranking ordered by score, with anonymous entries showing "Participante anônimo" — in `tests/integration/groups.test.ts`

### Implementation for User Story 3

- [X] T029 [US3] Implement `createEntry(themeId, userId, submissionId)`, `deleteEntry(submissionId)`, `setDisplayAs(submissionId, displayAs)`, `getEntryByUserAndTheme(themeId, userId)`, `getEntryBySubmission(submissionId)` in `src/modules/groups/entry.ts` (mirrors `weekly/entry.ts`)
- [X] T030 [US3] Update `src/modules/groups/index.ts` to re-export the `entry.ts` functions (depends on T029)
- [X] T031 [US3] Extend `createSubmission` in `src/modules/submissions/index.ts`: accept `groupThemeId` (schema field, mutually exclusive with `weeklyThemeId` — 400 `VALIDATION_ERROR` if both present), branch parallel to the existing `weeklyThemeId` block but calling `groups.requireGroupMember` instead of a premium-tier check, verifying the theme is active and the user has no existing entry, creating the `GroupThemeEntry` atomically with the submission
- [X] T032 [US3] Extend `confirmSubmission` (same file) to accept `groupDisplayAs`, requiring it (400 `DISPLAY_AS_REQUIRED`) when a `groupEntry` exists, calling `groups.setDisplayAs`
- [X] T033 [US3] Extend `GET /api/groups/{id}` (`src/app/api/groups/[id]/route.ts`) to include `ranking` (via `groups.getLiveRanking`, active theme if present, else the most recently closed one)
- [X] T034 [US3] Extend `src/app/(app)/groups/[id]/page.tsx`: ranking table (rank, displayName, totalScore) and, when an active theme exists and the member has no entry, a link into the existing submission flow pre-filled with `groupThemeId`

**Checkpoint**: Members can submit against a group theme and see the group ranking. US1/US2
unaffected.

---

## Phase 6: User Story 4 — Líder Gerencia o Grupo (Priority: P3)

**Goal**: The leader can view members, remove a member, regenerate the invite code, and
delete the group.

**Independent Test**: As the leader, remove a member and confirm they lose group access
while their past ranking entry stays; regenerate the invite and confirm the old code stops
working; delete the group and confirm it's gone for all former members.

### Tests for User Story 4

- [X] T035 [P] [US4] Unit test: `removeMember` frees the removed user's membership slot but leaves their `GroupThemeEntry.finalRank` untouched; `removeMember` on the leader themself is rejected with `VALIDATION_ERROR`; `regenerateInvite` invalidates the previous code; `deleteGroup` removes the group and cascades to themes/contents/entries/members — in `tests/unit/groups/group.test.ts`
- [X] T036 [P] [US4] Integration test: leader removes a member → member's subsequent `GET /api/groups/{id}` call returns 403 `NOT_GROUP_MEMBER`, but their ranking row remains visible to others; leader regenerates invite → old code returns `INVITE_NOT_FOUND`; leader deletes the group → 404 for all former members — in `tests/integration/groups.test.ts`

### Implementation for User Story 4

- [X] T037 [US4] Implement `removeMember(groupId, leaderId, userId)`, `regenerateInvite(groupId, leaderId)`, `deleteGroup(groupId, leaderId)` in `src/modules/groups/group.ts` (extends the file from T007; all three require `requireGroupLeader`)
- [X] T038 [US4] Update `src/modules/groups/index.ts` to re-export the new `group.ts` functions (depends on T037)
- [X] T039 [US4] Implement `DELETE /api/groups/{id}` in `src/app/api/groups/[id]/route.ts`, `POST /api/groups/{id}/invite` in `src/app/api/groups/[id]/invite/route.ts`, `DELETE /api/groups/{id}/members/{userId}` in `src/app/api/groups/[id]/members/[userId]/route.ts`
- [X] T040 [US4] Extend `src/app/(app)/groups/[id]/page.tsx`: leader-only "Remover" button per member row, "Gerar novo convite" button, "Excluir grupo" control with a confirmation step

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification and quality gates across the feature; no new user-facing behavior.

- [X] T041 [P] Integration test: deleting a leader's account (existing LGPD flow in `src/modules/auth/deletion.ts`) leaves their group intact with `leaderId = null` (schema `onDelete: SetNull`) and `proposeTheme` on that group now fails cleanly (no leader to authorize); deleting a member's account cascades away their `GroupMember`/`GroupThemeEntry` rows (schema `onDelete: Cascade`) without renumbering other members' `finalRank` — in `tests/integration/groups.test.ts`
- [X] T042 [P] Sweep group-related copy (`src/app/(app)/groups/**`) for pt-BR consistency with the rest of the app (error messages, button labels)
- [X] T043 Run `npm run lint` and the formatter; fix any issues
- [X] T044 Run `npm run test` (Vitest); fix any failures
- [ ] T045 Execute the `specs/009-student-groups/quickstart.md` manual checklist end to end with two accounts (happy path + the caps/permissions table)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–6)**: All depend on Foundational.
  - US1 (P1) has no dependency on US2/US3/US4.
  - US2 (P2) is independently testable on top of US1 (needs a group to exist, but not its
    membership-management features).
  - US3 (P2) needs an active theme (US2) to be meaningful, but its own code (entry
    lifecycle, submission integration) is independent of US2's files.
  - US4 (P3) extends `group.ts`/`index.ts` from US1 — run its tasks after T007/T008 to avoid
    file churn (soft ordering, not a hard block).
- **Polish (Phase 7)**: After the desired stories are complete.

### Within Each User Story

- Tests written first and expected to FAIL before implementation.
- Module functions before the API routes that call them.
- API routes before the pages that call them.
- `src/modules/groups/index.ts` is touched by every phase (T008, T021, T030, T038) — keep
  those edits sequential, not parallel, within each phase.

### Parallel Opportunities

- Foundational: T004 (module stubs) is a single multi-file task; T002/T003 (schema/migrate)
  must precede it.
- US1: tests T005/T006 in parallel; implementation T009/T010 in parallel once T007/T008
  land; pages T012/T013/T014 and the nav edit T015 in parallel (four distinct files).
- US2: tests T016/T017 in parallel; T019 (`content.ts`) and T020 (`ranking.ts`) in parallel
  with each other and with T018 (`theme.ts`) — all three are new files with only a
  signature-level dependency already satisfied by the Phase 2 stubs; T023
  (content-upload-url route) in parallel with T022.
- US3: tests T027/T028 in parallel.
- US4: tests T035/T036 in parallel.
- Cross-story: once Foundational is done, US1 and (with a pre-existing group fixture) US2's
  module-level tests can be authored in parallel by different developers; US3 and US4 both
  build on US1's `group.ts`, so sequence them after US1 lands.
- Polish: T041, T042 in parallel.

---

## Parallel Example: User Story 1

```bash
# Author US1 tests together:
Task: "Unit test: joinGroup cap enforcement in tests/unit/groups/group.test.ts"
Task: "Integration test: create/join a group in tests/integration/groups.test.ts"

# Build US1 pages together once the API routes exist:
Task: "Groups list + create page in src/app/(app)/groups/page.tsx"
Task: "Join-by-link page in src/app/(app)/groups/join/[code]/page.tsx"
Task: "Group detail page in src/app/(app)/groups/[id]/page.tsx"
Task: "Fill the Grupos nav slot in src/app/(app)/BottomTabBar.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (directories).
2. Phase 2: Foundational (schema + migration + module stubs).
3. Phase 3: User Story 1 (create, invite, join, caps).
4. **STOP and VALIDATE**: create a group with one account, join with a second, confirm caps.
5. Deploy/demo — students can already form groups, even before themes exist.

### Incremental Delivery

1. Setup + Foundational → schema and module skeleton ready.
2. US1 → group creation/invite/join (MVP) → demo.
3. US2 → leader proposes/closes a theme → demo.
4. US3 → members submit and see the ranking → demo (feature is now end-to-end useful).
5. US4 → leader management (remove member, regenerate invite, delete group) → demo.

### Parallel Team Strategy

After Foundational: Developer A on US1; once US1's `group.ts`/`index.ts` land, Developer B
starts US2 and Developer C starts US4 (both extend US1's files, so they should coordinate
on `group.ts`/`index.ts` edits); US3 can start as soon as US2's theme lifecycle exists.

---

## Notes

- [P] = different files, no incomplete dependencies.
- `src/modules/groups/index.ts` and `group.ts` are each touched across multiple phases —
  not parallel across those specific tasks (T007/T008 vs. T018 vs. T037/T038).
- `src/app/(app)/groups/[id]/page.tsx` is built in US1 (T014) and extended in US2 (T026),
  US3 (T034), and US4 (T040) — sequential, same as `NewSubmissionForm.tsx` across stories in
  `specs/005-add-pdf-support`.
- No cron/sweep task exists for this feature — group themes have no deadline; the leader
  closes them manually (see research.md).
- Credit safety on the submission path comes from the existing pipeline: credits are only
  consumed at confirmation and refunded on grading failure, unchanged by this feature —
  assert this explicitly in T027/T028 rather than re-implementing it.
- Commit after each task or logical group; verify tests fail before implementing.
