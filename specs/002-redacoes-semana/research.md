# Research: Argos — Redações da Semana

**Date**: 2026-06-15 | **Plan**: [plan.md](./plan.md)

This feature builds entirely on the existing Next.js + Prisma + Auth.js + R2 stack.
No new external services are required. Research below resolves the key design questions.

---

## Decision 1 — Admin Route Protection

**Decision**: Use Next.js `middleware.ts` to check session + `user.role` before serving
any request under `/admin` and `/api/admin`. Non-admin sessions are redirected (pages)
or receive 403 (API routes).

**Rationale**: Auth.js exposes `getToken()` in middleware, allowing a single central
check without duplicating auth logic in every handler. Adding a `role` field to the
`User` model (enum `USER | ADMIN`) is the minimal data change. Promoting a user to
admin is done once via a seed script or a one-time Prisma migration seed; no admin
self-registration UI is needed.

**Alternatives considered**:
- Per-route `getServerSession` check inside each handler — rejected; duplicates the
  same check in every admin route, violating Constitution I (repetitive) and III
  (no single boundary).
- Separate Next.js app for admin — rejected; introduces a second deploy and second
  codebase for a feature used by one person (Constitution II).

---

## Decision 2 — File Upload for Admin Support Content

**Decision**: Reuse the existing presigned-URL pattern (same as essay images) for
admin file uploads. The admin UI calls `POST /api/admin/weekly-themes/{id}/content-upload-url`
to get a presigned R2 PUT URL, uploads directly from the browser, then confirms with
`POST /api/admin/weekly-themes/{id}/contents`. Files are stored under a
`weekly-themes/{themeId}/content/` prefix with no automatic deletion.

**Rationale**: The presigned-URL approach is already proven for essay image uploads;
no new upload infrastructure needed. Admin files (images/PDFs) are typically larger
than JSON payloads, so server-proxying would add unnecessary memory pressure on the
Node process (Constitution V — no decisions that would strain scale).

**Alternatives considered**:
- Server-side proxy upload (multipart form → API route → R2) — rejected; adds memory
  pressure and is an unnecessary extra hop for a pattern already solved by presigned
  URLs.
- Base64-encoded JSON upload — rejected; inefficient for PDFs; breaks at >~5 MB
  payloads common for scanned supporting documents.

---

## Decision 3 — Ranking Query Strategy

**Decision**: Compute the ranking at query time via a Prisma query joining
`WeeklyThemeEntry → Submission (status = completed) → Evaluation`, ordered by
`totalScore DESC, submission.confirmedAt ASC`. Add a composite index on
`(themeId, totalScore)` on `WeeklyThemeEntry`. At theme closure, persist `finalRank`
on each `WeeklyThemeEntry` row (computed once, stored for historical reads).

**Rationale**: At v1 scale a weekly theme will have at most a few hundred participants
(1 k submissions/hour across all users; premium-only participation further limits it).
A real-time indexed JOIN over hundreds of rows is well within PostgreSQL's capabilities
without materialization. Persisting `finalRank` at closure avoids re-computing the rank
every time a student checks their history for an old theme.

**Alternatives considered**:
- Materialized view or cached ranking — rejected at v1 scale; adds infrastructure
  (Redis) or PostgreSQL complexity that Constitution II prohibits without measured need.
- Storing rank in a separate column updated on every new evaluation — rejected;
  requires locking all entries on each update; error-prone under concurrent writes.

**Tiebreaker rule**: same `totalScore` → earlier `submission.confirmedAt` wins. This is
deterministic, requires no additional data, and rewards students who submitted first.

---

## Decision 4 — Submission Flow Integration

**Decision**: Extend the existing submission API minimally:
- `POST /api/submissions` accepts an optional `weeklyThemeId: string`. When present,
  the submissions module verifies: (a) user is premium, (b) theme is active, (c) user
  has no existing entry for this theme. A `WeeklyThemeEntry` row is created (status
  pending) so the uniqueness constraint is asserted immediately (no race condition).
- `POST /api/submissions/{id}/confirm` accepts an optional `weeklyDisplayAs: "real" |
  "anonymous"`. When the submission is linked to a weekly theme, this field is required;
  the entry's `displayAs` is updated at confirmation time.

**Rationale**: Reuses the entire upload → OCR → review → confirm → grade pipeline with
no duplication (Constitution III). The `WeeklyThemeEntry` row is created at submission
start (not at confirmation) so a user cannot start two submissions for the same theme
concurrently. If the submission is abandoned or fails, the entry is deleted and the slot
is freed.

**Alternatives considered**:
- Separate `POST /api/weekly-themes/active/submissions` endpoint that forks the flow —
  rejected; duplicates submission creation logic (Constitution III).
- Link entry only at confirmation — rejected; creates a race condition where two tabs
  could both reach the review step before either confirms.

---

## Decision 5 — Auto-Close Mechanism

**Decision**: Extend the existing interval sweep in `src/instrumentation.ts` with a
weekly-theme sweep that runs every minute. It queries `WeeklyTheme` where
`status = ACTIVE AND endsAt <= now()`, closes each (sets `status = CLOSED`,
`closedAt = now()`), and then calls `weekly.computeAndStoreFinalRanks(themeId)` to
persist `finalRank` on all entries.

**Rationale**: `instrumentation.ts` already manages the abandoned-submission sweep.
Adding a second interval to the same file keeps all background work in one place
(Constitution II). The sweep runs frequently (every minute) but the work per run is
minimal (check one condition; process at most one theme closure per interval given
the one-active-at-a-time constraint).

**Alternatives considered**:
- Cron job / external scheduler — rejected; adds infrastructure dependency for a task
  that the Node process can handle trivially (Constitution II).
- Trigger closure on the first request after deadline — rejected; ranking becomes
  observable as inconsistent (theme shows as active via countdown but has no entries
  processing) until a request happens to trigger the closure.
