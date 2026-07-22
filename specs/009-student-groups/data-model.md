# Data Model: Argos — Grupos de Alunos

**Date**: 2026-07-22 | **Plan**: [plan.md](./plan.md)

Extends the existing data model at `specs/001-enem-essay-grading/data-model.md` and
`specs/002-redacoes-semana/data-model.md`. All new tables live in the same PostgreSQL
database via Prisma. Names below are Prisma model names; columns use camelCase. Design
rationale for the shape decisions below is in [research.md](./research.md).

---

## Entity Relationship Overview (additions)

```text
User 0..1──* Group              (leaderId — nullable, SetNull on user deletion)
User 1──* GroupMember           (a student's joined-group rows)
Group 1──* GroupMember
Group 1──* GroupTheme
GroupTheme 1──* GroupThemeContent
GroupTheme 1──* GroupThemeEntry
GroupThemeEntry 1──1 Submission     (each entry links to one submission)
GroupThemeEntry *──1 User           (each user has at most one entry per group theme)
```

---

## Changes to Existing Models

### User — new relations only, no new fields

| Field | Type | Notes |
|---|---|---|
| ledGroups | Group[] | inverse of `Group.leaderId` |
| groupMemberships | GroupMember[] | inverse of `GroupMember.userId` |
| groupThemeEntries | GroupThemeEntry[] | inverse of `GroupThemeEntry.userId` |

No new scalar column — leadership and membership are tracked entirely on the new tables.

### Submission — new optional relation

| Field | Type | Notes |
|---|---|---|
| groupEntry | GroupThemeEntry? | inverse relation; null for regular and weekly submissions |

No new column on `Submission`; the relation is owned by `GroupThemeEntry.submissionId`
(same pattern as the existing `weeklyEntry` relation).

---

## New Models

### Group

A student-led group of up to 30 participants (leader + members).

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | string | chosen by the creator at creation |
| leaderId | FK → User? | nullable; `onDelete: SetNull` — group survives leader-account deletion, leaderless (see research.md) |
| inviteCode | string, unique | URL-safe random token; regenerable |
| createdAt / updatedAt | datetime | |

**Membership rule** (not a DB constraint, computed): a user is "part of" a group iff
`leaderId === userId OR a GroupMember row with (groupId, userId) exists`.

**Cap rule** (enforced in the `groups` module, not the DB — same non-DB-constraint pattern
as `WeeklyTheme`'s "one active theme" rule, for the same future-proofing reason): joining
is rejected once `count(GroupMember WHERE groupId) + 1 (leader) >= 30`. A user cannot hold
more than 5 `GroupMember` rows at once (leading groups doesn't count toward this).

### GroupMember

Records a student's membership in a group, joined via invite. Does **not** include the
leader (see research.md).

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| groupId | FK → Group, `onDelete: Cascade` | |
| userId | FK → User, `onDelete: Cascade` | |
| joinedAt | datetime | `@default(now())` |

**Unique constraint**: `(groupId, userId)` — a student can't join the same group twice.

### GroupTheme

An essay challenge proposed by a group's leader. Structurally identical to `WeeklyTheme`
minus the deadline fields (`endsAt`/auto-close — no functional requirement for them here;
see research.md).

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| groupId | FK → Group, `onDelete: Cascade` | |
| title | string | the essay prompt / enunciado |
| status | enum `GroupThemeStatus` | `active` \| `closed` |
| publishedAt | datetime | `@default(now())` |
| closedAt | datetime? | set when status transitions to `closed` |
| createdAt / updatedAt | datetime | |

**Constraint**: at most one row with `status = active` per `groupId` at any time — enforced
in the `groups` module (same pattern as `WeeklyTheme`).

**State machine**:
```text
active ──(leader closes manually)──▶ closed
```
Transitions are one-way; no reactivation, and no automatic transition (no deadline).

### GroupThemeContent

Optional support material attached to a group theme. Same shape as `WeeklyThemeContent`.

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| themeId | FK → GroupTheme, `onDelete: Cascade` | |
| kind | enum `GroupContentKind` | `text` \| `file` |
| body | string? | plain text body; set when `kind = text` |
| fileKey | string? | R2 object key; set when `kind = file`. Prefix: `group-themes/{themeId}/content/{id}` |
| fileType | enum `GroupFileKind`? | `image` \| `pdf`; set when `kind = file` |
| displayOrder | int | `@default(0)` |
| createdAt | datetime | |

**Note**: files are never automatically deleted (same convention as `weekly-themes/`
content); permanent reference material until the group/theme is deleted.

### GroupThemeEntry

Records a member's participation in a group theme. Same lifecycle as `WeeklyThemeEntry`.

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| themeId | FK → GroupTheme, `onDelete: Cascade` | |
| userId | FK → User, `onDelete: Cascade` | |
| submissionId | FK → Submission, unique, `onDelete: Cascade` | one entry per submission |
| displayAs | enum `GroupDisplayAs` | `real` \| `anonymous`; set at submission confirmation |
| finalRank | int? | ordinal position at theme closure; null while theme is `active` |
| createdAt | datetime | |

**Unique constraints**:
- `(themeId, userId)` — one entry per user per theme; row is created at submission start,
  before confirmation, same as `WeeklyThemeEntry`.
- `submissionId` — one entry per submission.

**Entry lifecycle** (identical shape to `WeeklyThemeEntry`):
```text
created (at POST /api/submissions with groupThemeId)
  │
  ├── submission abandoned/failed → entry DELETED; slot freed
  │
  └── submission confirmed → displayAs SET
        │
        └── leader closes theme → finalRank SET
```

---

## Prisma Enums

```prisma
enum GroupThemeStatus {
  active
  closed
}

enum GroupContentKind {
  text
  file
}

enum GroupFileKind {
  image
  pdf
}

enum GroupDisplayAs {
  real
  anonymous
}
```

---

## Indexes

| Table | Index | Purpose |
|---|---|---|
| `Group` | `leaderId` | list groups a user leads |
| `Group` | `inviteCode` unique | invite lookup on join |
| `GroupMember` | `(groupId, userId)` unique | uniqueness + membership check |
| `GroupMember` | `userId` | count/list a student's joined groups (5-cap check) |
| `GroupTheme` | `(groupId, status)` | fast lookup of a group's single active theme |
| `GroupThemeEntry` | `(themeId, userId)` unique | uniqueness + lookup |
| `GroupThemeEntry` | `themeId` | ranking query scoped to a theme |
| `GroupThemeEntry` | `userId` | LGPD deletion cleanup |

---

## Derived Views (no extra tables)

- **Group-only live ranking**: JOIN `GroupThemeEntry → Submission → Evaluation` WHERE
  `submission.status = completed` ORDER BY `evaluation.totalScore DESC,
  submission.confirmedAt ASC`, scoped to `themeId`. Real-time; capped at 30 rows by
  construction (no top-N truncation needed, unlike the global 50-of-many ranking).

- **Group listing for a user**: `Group` WHERE `leaderId = ?` UNION `Group` JOIN
  `GroupMember` WHERE `GroupMember.userId = ?`.

---

## LGPD account deletion extension

On account deletion (`src/modules/auth/deletion.ts`, `runAccountDeletion`), add to the
existing job sequence (after Submissions, before the final `User` delete — the schema-level
cascades below fire automatically as part of that same delete):

- `GroupMember` rows for the user are removed (`onDelete: Cascade` on `userId`) — the
  user's joined-group slots are freed.
- `GroupThemeEntry` rows for the user are removed (`onDelete: Cascade` on `userId`); if the
  entry had a `finalRank` on a closed theme, the ranking slot is vacated without
  recomputing other members' ranks — closed rankings are historical records (same rule as
  `WeeklyThemeEntry`).
- Groups the user **leads** are *not* deleted — `Group.leaderId` is set to `null`
  (`onDelete: SetNull`); the group and its history remain visible to remaining members, but
  no new theme can be proposed until a future version adds leadership transfer (out of
  scope here — see spec Edge Cases).
