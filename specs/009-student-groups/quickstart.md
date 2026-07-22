# Quickstart: Argos — Grupos de Alunos

Bring up the app and exercise the group creation → invite → theme → submission → ranking
flow end to end.

## Prerequisites

- Existing local setup for Argos ENEM (see `specs/001-enem-essay-grading/stack.md`).
- `.env` configured (DB, R2, service-account credentials for OCR/grading — same as the
  base submission flow; no new env vars for this feature).
- For deterministic runs without hitting Vision/Vertex AI, set `FAKE_VENDORS=1`.
- Two test accounts (a leader and at least one member) — group flows require multiple
  users, unlike the single-admin weekly-theme flow.

## Run

```bash
npx prisma migrate dev   # applies the new Group/GroupMember/GroupTheme/... tables
npm run dev
# open http://localhost:3000 and sign in as user A (will be the leader)
```

## Manual test — happy path

1. Go to **Grupos** (bottom nav on mobile, or the reserved nav slot on desktop).
2. Create a group, e.g. "Turma da Ana". Expect: group appears in the list with you as
   leader, and an invite link/code is shown.
3. In a second session (or incognito), sign in as user B and open the invite link (or paste
   the code on **Grupos → Entrar com código**). Expect: user B now sees the group in their
   list with role "membro".
4. As the leader (user A), open the group and propose a theme: enunciado + one text support
   content + one uploaded reference file. Expect: the theme appears active for both users.
5. As user B, submit an essay against the group's active theme via the existing submission
   flow (photo → OCR review → confirm, choosing "nome real" or "anônimo"). Expect: normal
   credit consumption (no premium gate), evaluation completes, and user B's result appears
   in the group's ranking within the group page.
6. As the leader, close the theme. Expect: the ranking freezes (`finalRank` set); the
   leader can now propose a new theme.

## Manual test — caps and permissions

| Case | Action | Expected |
|------|--------|----------|
| Group full | Join a group already at 30 participants | 409, "grupo atingiu o limite de membros" |
| Member cap | Join a 6th group as member (already in 5) | 409, "limite de grupos por aluno" — leading groups doesn't count |
| Non-leader proposes theme | Member calls propose-theme | 403 `NOT_GROUP_LEADER` |
| Non-member accesses group | Unrelated user opens `/groups/{id}` | 403 `NOT_GROUP_MEMBER` |
| Double theme | Leader proposes a theme while one is active | 409 `ACTIVE_THEME_EXISTS` |
| Double submission | Member submits twice to the same group theme | 409 `ALREADY_ENTERED` |
| Invite regenerated | Old invite link used after leader regenerates | 404 `INVITE_NOT_FOUND` |
| Leader account deleted | Leader runs LGPD account deletion while leading a group | Deletion succeeds; group remains, visible to members, with no leader; proposing a new theme is blocked until a future leadership-transfer feature ships |

## Automated tests

```bash
npm run test        # Vitest: groups module (unit) + integration
npx playwright test # e2e: not extended for this feature (see plan.md)
```

Key coverage to add:
- `groups` unit tests (`tests/unit/groups/`): cap enforcement (30 participants, 5 groups as
  member excluding led groups), one-active-theme-per-group, entry lifecycle (create on
  submission start → delete on abandonment → displayAs on confirm → finalRank on close),
  invite regeneration invalidates the old code, leader-account deletion sets `leaderId`
  to `null` without deleting the group.
- `submissions` unit tests: `groupThemeId` branch mirrors the existing `weeklyThemeId`
  branch but checks membership instead of subscription tier, and rejects when both
  `weeklyThemeId` and `groupThemeId` are present.
- Integration (`tests/integration/groups.test.ts`, mirroring `weekly-admin.test.ts`): full
  create → join → propose → submit → close → ranking cycle against a test Postgres
  instance, plus the permission/cap error cases above.
