# API Contract: Argos — Redações da Semana

**Date**: 2026-06-15 | **Plan**: [../plan.md](../plan.md)

Extension to `specs/001-enem-essay-grading/contracts/api.md`. All conventions
from the base contract apply (JSON in/out, `{error:{code,message}}` shape, Zod
validation, 400 on invalid input). New error codes are listed at the end.

---

## Changes to Existing Endpoints

### `POST /api/submissions` — new optional field

| Field | Type | Notes |
|---|---|---|
| `weeklyThemeId` | `string?` | UUID of the active `WeeklyTheme`. When present: validates user is premium (402 `PREMIUM_REQUIRED`), theme is active (409 `THEME_NOT_ACTIVE`), user has no existing entry (409 `ALREADY_ENTERED`). Creates a `WeeklyThemeEntry` row atomically with the submission row. |

No change to response shape.

### `POST /api/submissions/{id}/confirm` — new optional field

| Field | Type | Notes |
|---|---|---|
| `weeklyDisplayAs` | `"real" \| "anonymous"?` | Required when the submission is linked to a weekly theme (400 `DISPLAY_AS_REQUIRED` if missing); ignored otherwise. Sets `WeeklyThemeEntry.displayAs`. |

No change to response shape.

---

## New Endpoints — Public (no auth required)

### Weekly Themes (`modules/weekly`)

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/api/weekly-themes/active` | Active theme + public ranking | No auth. Returns theme data and top-50 ranking. 404 `NO_ACTIVE_THEME` when none exists. See response shape below. |

#### `GET /api/weekly-themes/active` response

```json
{
  "theme": {
    "id": "uuid",
    "title": "A violência urbana e suas raízes socioeconômicas",
    "endsAt": "2026-06-22T23:59:59Z",
    "contents": [
      { "kind": "TEXT", "body": "Texto I — …", "displayOrder": 1 },
      { "kind": "FILE", "fileUrl": "https://…/conteudo.pdf", "fileType": "PDF", "displayOrder": 2 }
    ]
  },
  "ranking": [
    {
      "rank": 1,
      "displayName": "Maria S.",
      "totalScore": 960,
      "submittedAt": "2026-06-16T10:23:00Z"
    },
    {
      "rank": 2,
      "displayName": "Participante anônimo",
      "totalScore": 920,
      "submittedAt": "2026-06-16T14:05:00Z"
    }
  ],
  "participantCount": 147
}
```

`displayName` is the user's real name when `displayAs = REAL`; `"Participante anônimo"`
when `displayAs = ANONYMOUS`. `fileUrl` is a time-limited signed read URL (R2).

---

## New Endpoints — Authenticated

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/api/weekly-themes/active/my-entry` | Authenticated user's rank + entry | Auth required; 404 if user has no entry for the active theme; 404 `NO_ACTIVE_THEME` if no theme is active. See response shape below. |
| GET | `/api/weekly-themes/history` | Student's participation history | Auth required; paginated (`?page=1`). Lists past themes where the user participated. See response shape below. |

#### `GET /api/weekly-themes/active/my-entry` response

```json
{
  "submissionId": "uuid",
  "submissionStatus": "completed",
  "totalScore": 840,
  "rank": 23,
  "totalParticipants": 147,
  "displayAs": "real"
}
```

`rank` is the user's live ordinal position (computed on-demand). `submissionStatus`
follows the existing submission status enum; if `grading`, rank is `null` (score not yet
available).

#### `GET /api/weekly-themes/history` response

```json
{
  "entries": [
    {
      "themeId": "uuid",
      "themeTitle": "A violência urbana…",
      "closedAt": "2026-06-22T23:59:59Z",
      "totalScore": 840,
      "finalRank": 23,
      "totalParticipants": 147
    }
  ],
  "pagination": { "page": 1, "totalPages": 3 }
}
```

`totalParticipants` is the count of entries with `finalRank IS NOT NULL` for the theme
(i.e., entries that reached a completed submission before closure).

---

## New Endpoints — Admin (role: ADMIN required)

All `/api/admin/*` endpoints return 403 `FORBIDDEN` for non-admin sessions.

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/api/admin/weekly-themes` | List all themes | Paginated; ordered by `publishedAt DESC`. Each item: `{id, title, status, publishedAt, endsAt, participantCount}`. |
| POST | `/api/admin/weekly-themes` | Create and publish a theme | Body: `{title, durationDays?: number}`. `durationDays` defaults to 7. Fails with 409 `ACTIVE_THEME_EXISTS` if a theme is already active. Returns created theme. 201. |
| GET | `/api/admin/weekly-themes/{id}` | Get theme detail | Includes full content list (text bodies + signed file URLs). |
| PATCH | `/api/admin/weekly-themes/{id}` | Extend deadline or close | Body: `{action: "extend", endsAt: string}` or `{action: "close"}`. 409 `ALREADY_CLOSED` if theme is closed. |
| GET | `/api/admin/weekly-themes/{id}/metrics` | Theme participation metrics | See response shape below. |
| POST | `/api/admin/weekly-themes/{id}/content-upload-url` | Get presigned URL for file upload | Body: `{fileType: "IMAGE"\|"PDF", contentType: string, sizeBytes: number}`. Returns `{contentId, uploadUrl}`. Max 20 MB. |
| POST | `/api/admin/weekly-themes/{id}/contents` | Confirm and register a content item | After upload completes. Body: `{contentId, kind: "FILE", fileType, displayOrder}` or `{kind: "TEXT", body, displayOrder}`. |
| DELETE | `/api/admin/weekly-themes/{id}/contents/{contentId}` | Remove a content item | Deletes R2 object if FILE kind. |
| GET | `/api/admin/metrics` | General app metrics | See response shape below. |

#### `GET /api/admin/weekly-themes/{id}/metrics` response

```json
{
  "participantCount": 147,
  "avgTotalScore": 712,
  "scoreDistribution": {
    "c1": { "0": 5, "40": 12, "80": 30, "120": 45, "160": 40, "200": 15 },
    "c2": { "0": 2, "40": 8, "80": 25, "120": 52, "160": 48, "200": 12 },
    "c3": { "0": 3, "40": 10, "80": 28, "120": 50, "160": 42, "200": 14 },
    "c4": { "0": 4, "40": 11, "80": 29, "120": 48, "160": 43, "200": 12 },
    "c5": { "0": 8, "40": 15, "80": 35, "120": 42, "160": 35, "200": 12 }
  }
}
```

Includes only entries with `submission.status = completed` (evaluated submissions).

#### `GET /api/admin/metrics` response

```json
{
  "totalUsers": 3241,
  "totalSubmissions": 8904,
  "usersByPlan": [
    { "tier": "free", "count": 2105 },
    { "tier": "entry", "count": 891 },
    { "tier": "premium", "count": 245 }
  ]
}
```

`free` tier = users with no active subscription. Counts reflect current state (not
historical). `totalSubmissions` counts all non-abandoned submissions (any status except
`expired` from abandonment).

---

## New Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `PREMIUM_REQUIRED` | 402 | Action requires a premium subscription |
| `THEME_NOT_ACTIVE` | 409 | Referenced weekly theme is not currently active |
| `ALREADY_ENTERED` | 409 | User already has an entry for this weekly theme |
| `NO_ACTIVE_THEME` | 404 | No weekly theme is currently active |
| `ACTIVE_THEME_EXISTS` | 409 | Cannot publish; another theme is already active |
| `ALREADY_CLOSED` | 409 | Theme is already closed; cannot modify |
| `DISPLAY_AS_REQUIRED` | 400 | `weeklyDisplayAs` is required for weekly theme submissions |
