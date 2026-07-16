# Data Model: Argos — Redações da Semana

**Date**: 2026-06-15 | **Plan**: [plan.md](./plan.md)

Extends the existing data model at `specs/001-enem-essay-grading/data-model.md`.
All new tables live in the same PostgreSQL database via Prisma. Names below are Prisma
model names; columns use camelCase.

---

## Entity Relationship Overview (additions)

```text
User 1──* WeeklyTheme          (published_by — admin creates themes)
WeeklyTheme 1──* WeeklyThemeContent
WeeklyTheme 1──* WeeklyThemeEntry
WeeklyThemeEntry 1──1 Submission    (each entry links to one submission)
WeeklyThemeEntry *──1 User          (each user has at most one entry per theme)
```

---

## Changes to Existing Models

### User — new field

| Field | Type | Notes |
|---|---|---|
| role | enum `UserRole` | `USER` (default) \| `ADMIN`; gates access to `/admin` routes |

**Migration note**: existing users receive `USER` via `@default(USER)`; admin promotion
is done once via Prisma seed or a one-off migration script.

### Submission — new optional relation

| Field | Type | Notes |
|---|---|---|
| weeklyEntry | WeeklyThemeEntry? | inverse relation; null for regular submissions |

No new column on `Submission`; the relation is owned by `WeeklyThemeEntry.submissionId`.

---

## New Models

### WeeklyTheme

Represents one weekly challenge published by an admin.

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| title | string | the essay prompt / enunciado |
| status | enum `WeeklyThemeStatus` | `ACTIVE` \| `CLOSED` |
| publishedAt | datetime | set at publication (`@default(now())`) |
| endsAt | datetime | deadline; mutable (admin can extend) |
| closedAt | datetime? | set when status transitions to `CLOSED` |
| publishedById | FK → User | admin who published; required |
| createdAt / updatedAt | datetime | |

**Constraint**: at most one row with `status = ACTIVE` at any time — enforced in the
`weekly` module (not as a DB constraint, to allow a single-transaction
close-then-create flow in the future).

**State machine**:
```text
ACTIVE ──(endsAt reached or admin closes)──▶ CLOSED
```
Transitions are one-way; no reactivation.

### WeeklyThemeContent

Optional support material attached to a theme. A theme may have multiple items of
both kinds in any combination.

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| themeId | FK → WeeklyTheme | |
| kind | enum `WeeklyContentKind` | `TEXT` \| `FILE` |
| body | string? | plain text body; set when `kind = TEXT`; null for FILE |
| fileKey | string? | R2 object key; set when `kind = FILE`; null for TEXT. Prefix: `weekly-themes/{themeId}/content/{id}` |
| fileType | enum `FileKind`? | `IMAGE` \| `PDF`; set when `kind = FILE` |
| displayOrder | int | admin-defined ordering for UI display |
| createdAt | datetime | |

**Note**: `WeeklyThemeContent` files are **never automatically deleted** (unlike essay
images); they are permanent reference material for the theme.

### WeeklyThemeEntry

Records a student's participation in a weekly theme. Created when the student starts
a submission linked to the theme; updated at confirmation (anonymity preference) and
at theme closure (final rank).

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| themeId | FK → WeeklyTheme | |
| userId | FK → User | participant |
| submissionId | FK → Submission unique | one entry per submission |
| displayAs | enum `DisplayAs` | `REAL` \| `ANONYMOUS`; set at submission confirmation |
| finalRank | int? | ordinal position at theme closure; null while theme is ACTIVE |
| createdAt | datetime | |

**Unique constraints**:
- `(themeId, userId)` — one entry per user per theme; prevents concurrent double-entry
  (the row is created at submission start, before confirmation).
- `submissionId` — one entry per submission (unique FK).

**Entry lifecycle**:
```text
created (at POST /api/submissions with weeklyThemeId)
  │
  ├── submission abandoned/failed → entry DELETED; slot freed
  │
  └── submission confirmed → displayAs SET
        │
        └── theme closes → finalRank SET
```

---

## Indexes

| Table | Index | Purpose |
|---|---|---|
| `WeeklyTheme` | `status` | fast lookup of the single active theme |
| `WeeklyThemeEntry` | `(themeId, userId)` unique | uniqueness + lookup |
| `WeeklyThemeEntry` | `themeId` | ranking query scoped to a theme |
| `WeeklyThemeEntry` | `userId` | student history queries |

---

## Derived Views (no extra tables)

- **Live ranking** (top 50 + user position): JOIN `WeeklyThemeEntry → Submission →
  Evaluation` WHERE `submission.status = completed` ORDER BY
  `evaluation.totalScore DESC, submission.confirmedAt ASC`. Real-time; no
  materialization at v1 scale (Constitution II).

- **Student history**: `WeeklyThemeEntry` WHERE `userId = ? AND finalRank IS NOT NULL`
  JOIN `WeeklyTheme` (title) — shows past participations with final position.

- **Admin theme metrics**: GROUP BY `WeeklyThemeEntry.themeId` → participant count;
  JOIN `Evaluation` → avg `totalScore`, distribution per competency (C1–C5).

- **General app metrics**: count of `User` rows (minus soft-deleted), count of
  `Submission` rows, count of `Subscription` rows grouped by `SubscriptionPlan.tier`.

---

## LGPD account deletion extension

On account deletion, add to the existing job sequence (after Submissions):
delete `WeeklyThemeEntry` rows for the user. If the entry has a `finalRank` and the
theme is closed, the ranking slot is vacated (rank numbers of others are not
recomputed — closed rankings are historical records).
