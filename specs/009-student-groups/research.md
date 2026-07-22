# Phase 0 Research: Argos — Grupos de Alunos

**Date**: 2026-07-22 | **Plan**: [plan.md](./plan.md)

No items in Technical Context were marked `NEEDS CLARIFICATION` — the stack, storage, and
testing approach are fixed by the existing project (Constitution II: no new dependencies).
The open design questions below are about how to shape the new `groups` module, resolved by
looking at how the structurally closest existing feature (`weekly`) already solved each one.

---

## Decision: Reuse the `weekly` module's file shape, drop the deadline machinery

**Decision**: `src/modules/groups/` copies `weekly`'s split (`theme.ts`, `content.ts`,
`entry.ts`, `ranking.ts`, `views.ts`, `index.ts`), but has no `endsAt`/auto-close sweep.

**Rationale**: The spec has no theme duration — the leader closes a theme manually
whenever they choose (FR-014); there is no SC around automatic expiry. Building a
sweep (which `weekly` needs and registers in `/api/cron/sweep`) would be speculative
infrastructure for a requirement that doesn't exist (Constitution II).

**Alternatives considered**: Copying `weekly` verbatim including `endsAt` and wiring group
themes into the existing cron sweep. Rejected — adds a field and a sweep branch with no
functional requirement driving it, and would force a "default duration" UX decision the
spec never asked for.

---

## Decision: Invite code — a single unguessable token, not a short human-typed code

**Decision**: `Group.inviteCode` is a URL-safe random token generated with Node's built-in
`crypto.randomBytes(9).toString("base64url")` (12 chars, ~72 bits of entropy). The
shareable surface is a link (`/groups/join/{inviteCode}`); the same string also works if a
student pastes just the code into a "join by code" field.

**Rationale**: The spec calls for "código/link de convite" without requiring it to be
short enough to read aloud (unlike, say, a 6-digit game-lobby code), and reuses the same
`crypto` module already imported in `submissions/index.ts` (Constitution II — no new
dependency like `nanoid`). One field serves both the link and the typed-code path, keeping
the model simple (Constitution II).

**Alternatives considered**: A short numeric/alphanumeric code (e.g. 6 chars) for easy
verbal sharing. Rejected as unnecessary for this UX — invites are expected to be shared as
a link (chat, WhatsApp), not read aloud in a classroom; a longer token also makes
brute-force guessing of another group's invite impractical without extra rate-limiting.

---

## Decision: Leader is not a `GroupMember` row

**Decision**: Membership/cap tracking uses two distinct things: `Group.leaderId` (exactly
one, set at creation) and `GroupMember` rows (created only when a student joins via
invite). "Is this user part of the group" = `leaderId === userId OR a GroupMember row
exists`. The 30-person cap and 5-groups-as-member cap are both computed accordingly (see
data-model.md).

**Rationale**: FR-005 requires the 5-group member cap to exclude groups a student leads
("sem limite para quantos grupos pode liderar"). If group creation also inserted a
`GroupMember` row for the leader, a student who created 6 groups would hit their own
5-group cap on the 6th — contradicting the requirement. Keeping leadership out of the
`GroupMember` table sidesteps that without a special-cased "this membership doesn't count"
flag.

**Alternatives considered**: A `role` enum on `GroupMember` (`leader` | `member`) with cap
queries filtering `role = member`. Rejected — same outcome, but adds a role dimension to a
table that otherwise doesn't need one, and duplicates information already available via
`Group.leaderId`.

---

## Decision: 30-member cap counts the leader

**Decision**: The cap check on join is `GroupMember.count(groupId) + 1 (leader) >= 30` →
reject. So a group tops out at 1 leader + 29 joined members = 30 total participants.

**Rationale**: The spec frames the limit as "classroom-sized" (30 members total, per the
user's own framing when the limit was chosen); reading it as 30 *joined* members plus an
uncounted leader would let a group reach 31 people, drifting from that intent.

**Alternatives considered**: Cap only `GroupMember` rows at 30, leader on top (31 total).
Rejected as a looser reading than what was actually asked for.

---

## Decision: Group deletion on leader-account deletion is out of scope; leader becomes null

**Decision**: `Group.leaderId` is nullable with `onDelete: SetNull`. When a leader's
account is deleted (existing LGPD flow in `src/modules/auth/deletion.ts`, which hard-deletes
the `User` row), the group survives with `leaderId = null` — matching the spec's Edge Case
("grupo fica sem líder ativo... novas propostas de tema ficam bloqueadas").

**Rationale**: The current account-deletion flow (`runAccountDeletion`) ends with
`tx.user.delete()`. Any required, non-nullable FK to `User` without `onDelete: SetNull`
would make that hard delete fail with a foreign-key violation the moment a student who
leads a group tries to delete their account — silently breaking the existing LGPD deletion
right for a plausibly common case (any student can lead a group). `WeeklyTheme
.publishedById` gets away with a required, restrict-by-default FK today only because
publishers are admins, an operationally rare deletion case; that shortcut doesn't hold once
"leader" means "any student."

**Alternatives considered**: Block account deletion while the user leads an active group
(force them to delete/transfer it first). Rejected — adds friction to a legally-grounded
deletion right for a case the spec explicitly says should just leave the group leaderless.

---

## Decision: Group-scoped enums, not shared with `weekly`

**Decision**: New enums `GroupThemeStatus`, `GroupContentKind`, `GroupFileKind`,
`GroupDisplayAs` — structurally identical to `WeeklyThemeStatus`/`WeeklyContentKind`/
`WeeklyFileKind`/`WeeklyDisplayAs`, not reused across features.

**Rationale**: Matches the existing convention in `schema.prisma`, where every feature
namespaces its own enums (`Weekly*`) even when the value sets are identical in shape.
Sharing an enum across `WeeklyThemeEntry` and the new `GroupThemeEntry` would mean changing
`WeeklyThemeEntry`'s existing column type — an unnecessary migration risk to an
already-shipped table for a purely cosmetic dedup.

**Alternatives considered**: Renaming `WeeklyDisplayAs` → a shared `DisplayAs` reused by
both entities. Rejected — touches a live table/enum for no functional gain, against
Constitution II's bar that changes need concrete value, not speculative tidiness.
