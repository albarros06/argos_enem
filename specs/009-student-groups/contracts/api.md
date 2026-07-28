# API Contract: Argos — Grupos de Alunos

**Date**: 2026-07-22 | **Plan**: [../plan.md](../plan.md)

Extension to `specs/001-enem-essay-grading/contracts/api.md` and
`specs/002-redacoes-semana/contracts/api.md`. All conventions from the base contract apply
(JSON in/out, `{error:{code,message}}` shape, Zod validation, 400 on invalid input). All
`/api/groups/**` endpoints require an authenticated session (no public/unauthenticated
access — group data is private to leader + members). New error codes are listed at the end.

---

## Changes to Existing Endpoints

### `POST /api/submissions` — new optional field

| Field | Type | Notes |
|---|---|---|
| `groupThemeId` | `string?` | UUID of an active `GroupTheme`. When present: validates the caller is the group's leader or a `GroupMember` (403 `NOT_GROUP_MEMBER`), theme is active (409 `THEME_NOT_ACTIVE`), user has no existing entry (409 `ALREADY_ENTERED`). No plan/tier check — same credit rule as any regular submission. Creates a `GroupThemeEntry` row atomically with the submission row. Mutually exclusive with `weeklyThemeId` (400 `VALIDATION_ERROR` if both present). |

No change to response shape.

### `POST /api/submissions/{id}/confirm` — new optional field

| Field | Type | Notes |
|---|---|---|
| `groupDisplayAs` | `"real" \| "anonymous"?` | Required when the submission is linked to a group theme (400 `DISPLAY_AS_REQUIRED` if missing); ignored otherwise. Sets `GroupThemeEntry.displayAs`. |

No change to response shape.

---

## New Endpoints — Groups (`modules/groups`)

All require auth. Group-scoped endpoints (`/api/groups/{id}/**`) additionally require the
caller to be the group's leader or a member (403 `NOT_GROUP_MEMBER` otherwise); leader-only
actions are marked below and return 403 `NOT_GROUP_LEADER` for non-leaders.

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/api/groups` | List the caller's groups | Returns groups led and groups joined, each with `role: "leader" \| "member"`, `memberCount`, and whether an active theme exists. |
| POST | `/api/groups` | Create a group | Body: `{name}`. Caller becomes leader. Returns created group incl. `inviteCode`. 201. |
| POST | `/api/groups/join` | Join a group by invite | Body: `{inviteCode}`. 404 `INVITE_NOT_FOUND` if code doesn't match any group. 409 `GROUP_FULL` if the 30-participant cap is reached. 409 `MEMBER_GROUP_LIMIT` if the caller already belongs to 5 groups as a member. No-op success (200, not 409) if the caller already belongs to this group. |
| GET | `/api/groups/{id}` | Group detail | Members list, active theme (with contents), ranking of the active or most-recently-closed theme. |
| DELETE | `/api/groups/{id}` | Delete the group | **Leader only.** Cascades to themes, contents, entries, memberships. |
| POST | `/api/groups/{id}/invite` | Regenerate the invite code | **Leader only.** Old code stops working immediately. Returns new `inviteCode`. |
| DELETE | `/api/groups/{id}/members/{userId}` | Remove a member | **Leader only.** 404 `NOT_FOUND` if the target isn't a member. Removed member's past submissions/entries stay in the group's history (FR-007). Leader cannot remove themself this way (400 `VALIDATION_ERROR` — use group deletion instead). |
| POST | `/api/groups/{id}/themes` | Propose a theme | **Leader only.** Body: `{title}`. Fails with 409 `ACTIVE_THEME_EXISTS` if the group already has an active theme. Returns created theme. 201. |
| PATCH | `/api/groups/{id}/themes/{themeId}` | Close a theme | **Leader only.** Body: `{action: "close"}`. 409 `ALREADY_CLOSED` if already closed. Triggers `computeAndStoreFinalRanks` for the theme's entries. |
| POST | `/api/groups/{id}/themes/{themeId}/content-upload-url` | Presigned URL for a support file | **Leader only.** Body: `{fileType: "image"\|"pdf", contentType: string, sizeBytes: number}`. Returns `{contentId, uploadUrl}`. Max 20 MB (same limit as weekly content). |
| POST | `/api/groups/{id}/themes/{themeId}/contents` | Register a content item | **Leader only.** After upload completes. Body: `{contentId, kind:"file", fileType, displayOrder}` or `{kind:"text", body, displayOrder}`. |
| DELETE | `/api/groups/{id}/themes/{themeId}/contents/{contentId}` | Remove a content item | **Leader only.** Deletes the R2 object if `kind = file`. |

### `GET /api/groups` response

```json
{
  "groups": [
    {
      "id": "uuid",
      "name": "3º Ano B — Turma da Ana",
      "role": "leader",
      "memberCount": 12,
      "hasActiveTheme": true
    },
    {
      "id": "uuid",
      "name": "Grupo de Redação — Cursinho X",
      "role": "member",
      "memberCount": 30,
      "hasActiveTheme": false
    }
  ]
}
```

### `GET /api/groups/{id}` response

```json
{
  "group": {
    "id": "uuid",
    "name": "3º Ano B — Turma da Ana",
    "leaderId": "uuid",
    "leaderName": "Ana Souza",
    "inviteCode": "kJ8sQ2mN7pXw",
    "memberCount": 12
  },
  "members": [
    { "userId": "uuid", "name": "Ana Souza", "role": "leader", "joinedAt": null },
    { "userId": "uuid", "name": "Bruno Lima", "role": "member", "joinedAt": "2026-07-20T14:00:00Z" }
  ],
  "activeTheme": {
    "id": "uuid",
    "title": "A desinformação nas redes sociais",
    "publishedAt": "2026-07-21T10:00:00Z",
    "contents": [
      { "kind": "text", "body": "Texto I — …", "displayOrder": 1 },
      { "kind": "file", "fileUrl": "https://…/apoio.pdf", "fileType": "pdf", "displayOrder": 2 }
    ]
  },
  "ranking": [
    { "rank": 1, "displayName": "Bruno Lima", "totalScore": 880, "submittedAt": "2026-07-21T18:00:00Z" },
    { "rank": 2, "displayName": "Participante anônimo", "totalScore": 840, "submittedAt": "2026-07-21T20:12:00Z" }
  ]
}
```

`inviteCode` is `null` when the caller isn't the leader — only the leader can see or share the
invite code/link (or regenerate it). `leaderId`/`leaderName` are visible to every member.
`activeTheme` is `null` when no theme is active — in that case `ranking` reflects the most
recently closed theme (empty array if none). `displayName` follows the same convention as
the global ranking: real name when `displayAs = real`, `"Participante anônimo"` otherwise.

---

## New Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `NOT_GROUP_MEMBER` | 403 | Caller is neither the group's leader nor a member |
| `NOT_GROUP_LEADER` | 403 | Action requires being the group's leader |
| `INVITE_NOT_FOUND` | 404 | Invite code does not match any group |
| `GROUP_FULL` | 409 | Group already has 30 participants (leader + members) |
| `MEMBER_GROUP_LIMIT` | 409 | Caller already belongs to 5 groups as a member |
| `ACTIVE_THEME_EXISTS` | 409 | Cannot propose; the group already has an active theme |
| `ALREADY_CLOSED` | 409 | Theme is already closed; cannot modify |
| `THEME_NOT_ACTIVE` | 409 | Referenced group theme is not currently active |
| `ALREADY_ENTERED` | 409 | User already has an entry for this group theme |
| `DISPLAY_AS_REQUIRED` | 400 | `groupDisplayAs` is required for group-theme submissions |
