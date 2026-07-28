# Feature Specification: Supabase Row-Level Security Hardening

**Feature Branch**: `017-rls-implementation`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "Supabase's dashboard flags Row-Level Security (RLS) as disabled on every table in the `public` schema. Confirmed via direct query (`pg_tables.rowsecurity = false` on all 22 tables) and via Supabase's Security Advisor. Confirmed the project's Data API (PostgREST) is enabled, meaning tables are — or were, pending a toggle — reachable over HTTPS at `https://<project>.supabase.co/rest/v1/<table>` using the project's `anon`/`service_role` keys, independent of the application's own Prisma-based access path. The application itself never uses `supabase-js` or the Data API (verified: no `SUPABASE_*` env vars, no client import anywhere in the repo) and connects to Postgres exclusively via `DATABASE_URL`/`DIRECT_URL` through Prisma. Deliverable: enable RLS with a deny-by-default policy set across all public tables as defense-in-depth, without breaking the Prisma-driven application, which was independently confirmed unaffected because the app's DB role (`postgres`) carries the `BYPASSRLS` attribute."

## Overview

Supabase provisions two independent paths into the same Postgres database: (1) direct Postgres connections, used by this app's Prisma client via `DATABASE_URL`; and (2) the auto-generated Data API (PostgREST), reachable over HTTPS with the project's `anon`, `authenticated`, or `service_role` key. Row-Level Security is the access-control layer for path (2) — without it, any table is fully readable and writable by anyone holding a valid key, regardless of whether the application code ever calls that API.

This application does not use path (2) anywhere in its code, so RLS has had no functional relevance to date. However: the Data API was found **enabled** at the project level, and disabling it through the dashboard did not immediately stop it from serving live PostgREST responses when polled externally (10 checks over ~5 minutes, all returning the standard "no API key" 401 — see Edge Cases). Because that toggle's real-world effect could not be confirmed within this session, RLS must be treated as the primary, durable control rather than a backstop to a dashboard switch whose propagation is not yet verified.

The fix is standard and low-risk here specifically because the role the application uses to reach Postgres (`postgres`, via `DATABASE_URL`) has the `BYPASSRLS` role attribute (confirmed via `pg_roles`), while the Data API's keys map to `anon`/`authenticated`, which do **not** bypass RLS. Enabling RLS with no policies therefore locks out exactly the untrusted path and leaves the application's own path untouched.

## Clarifications

### Session 2026-07-28

- Q: Should per-table access policies be written (e.g., "authenticated users can read their own row"), or a blanket deny-all? → A: Blanket deny-all. The application does not use the Data API for any legitimate traffic today; writing real policies for tables that should never be reachable through PostgREST would be speculative work for a path this app doesn't use.
- Q: Does this replace disabling the Data API, or complement it? → A: Complement. Disabling the Data API remains the primary control (it removes the entire attack surface); RLS is defense-in-depth in case the Data API is ever re-enabled, a key leaks, or the disable toggle's propagation turns out to be incomplete or reversible.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deny-by-default access through the Data API (Priority: P1)

As the application owner, I need every table in the `public` schema to reject access via Supabase's Data API by default, so that possession of the `anon` or `authenticated` key — however it might come to be exposed — does not grant read or write access to any student, payment, or account data.

**Why this priority**: This is the entire point of the change. Without RLS, one leaked or discovered key is a full data breach across every table; with RLS enabled and zero policies, the same key grants nothing.

**Independent Test**: Can be tested by issuing a request to `https://<project>.supabase.co/rest/v1/<table>` with a valid `anon` key for each of the 22 tables and confirming every response is empty/denied rather than returning rows.

**Acceptance Scenarios**:

1. **Given** RLS is enabled on a table with no policies defined, **When** a request is made to that table's Data API endpoint with the `anon` key, **Then** the response contains zero rows (RLS default-denies in the absence of a matching policy).
2. **Given** the same request is made with the `authenticated` key, **Then** the response also contains zero rows, since no policy grants that role access either.
3. **Given** a request is made with the `service_role` key, **Then** access is still granted (that key carries `BYPASSRLS` by Supabase's design) — this is expected and out of scope to change, but MUST be documented so the `service_role` key is understood to require the same secrecy as a database superuser credential.

---

### User Story 2 - Zero regression to the running application (Priority: P1)

As the developer responsible for the running app, I need enabling RLS to have no effect whatsoever on the application's own database access, so this hardening change can ship without a functional testing cycle beyond a smoke check.

**Why this priority**: If this broke the app, it would be a self-inflicted outage on a system that was never actually vulnerable through its own code path — an unacceptable cost for a defense-in-depth change.

**Independent Test**: Can be tested by running the application's existing test suite and a manual smoke pass (login, submission flow, group flow, billing read) after the migration, confirming no new failures.

**Acceptance Scenarios**:

1. **Given** RLS is enabled with no policies on all 22 tables, **When** the application performs any Prisma query, **Then** the query succeeds exactly as before, because the `postgres` role's `BYPASSRLS` attribute exempts it from RLS enforcement entirely, independent of policies.
2. **Given** the full test suite is run post-migration, **When** results are compared to the pre-migration baseline, **Then** there are zero new failures attributable to the migration.

---

### User Story 3 - Resolve the Data API propagation discrepancy (Priority: P2)

As the person who disabled the Data API through the dashboard, I need to know definitively whether it is actually off, since a live poll (10 checks, ~5 minutes, from this session) still showed it serving standard PostgREST responses after the dashboard reported it disabled.

**Why this priority**: RLS mitigates the worst-case impact of this discrepancy, but an infrastructure toggle silently not taking effect is itself worth understanding — either it's a longer propagation window than expected, or the toggle isn't doing what the dashboard implies.

**Independent Test**: Re-poll the Data API endpoint after a longer interval (30–60 min) and, if still live, open a Supabase support ticket referencing the project ref, or check for a distinct "pause/restart" action some Supabase projects require for infra toggles to take effect.

**Acceptance Scenarios**:

1. **Given** sufficient time has passed since the toggle was flipped, **When** the endpoint is polled again, **Then** it either returns a distinctly different (disabled/paused) response, or the discrepancy is escalated to Supabase support with the observed evidence.

---

### Edge Cases

- **`service_role` key always bypasses RLS** (Supabase's own design, not something this feature can change) — if that key is ever introduced into client-reachable code, RLS provides zero protection. This must be called out explicitly so a future contributor doesn't assume RLS alone makes it safe to use `service_role` anywhere client-adjacent.
- **Data API toggle showed no observed effect after 5 minutes of polling** (10 checks at 30s intervals, all HTTP 401 "No API key found in request" — the standard live-PostgREST response) despite the dashboard reporting "disabled." RLS must not be treated as contingent on that toggle actually working; it is independently effective regardless of the Data API's on/off state.
- **`_prisma_migrations` table**: also has `rowsecurity = false` and is included in scope for consistency, even though it holds no user data — leaving one table unenabled would defeat the "100% coverage" success criterion and looks like an oversight to the next auditor.
- **Future feature wants the Data API for a specific table** (e.g., a client-side Supabase Realtime subscription): this is explicitly out of scope here. That table would need real, reviewed policies (not blanket deny-all) written and tested before any such feature ships — this spec does not pre-build them speculatively.
- **`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` requires the connecting role to be the table owner or have sufficient privilege**: since migrations run via `prisma migrate deploy` using `DATABASE_URL` (role `postgres`, which owns these tables), this is not expected to be a blocker, but must be confirmed during the migration dry run.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: RLS MUST be enabled (`ENABLE ROW LEVEL SECURITY`) on all 22 tables currently in the `public` schema: `Annotation`, `AuthToken`, `CreditTransaction`, `EssayTheme`, `Evaluation`, `Group`, `GroupMember`, `GroupTheme`, `GroupThemeContent`, `GroupThemeEntry`, `PaymentTransaction`, `RateLimitHit`, `Submission`, `Subscription`, `SubscriptionPlan`, `Transcription`, `User`, `WebhookEvent`, `WeeklyTheme`, `WeeklyThemeContent`, `WeeklyThemeEntry`, `_prisma_migrations`.
- **FR-002**: No access policies MUST be created for `anon` or `authenticated` on any of these tables — the intended state is deny-by-default, since the application does not use the Data API for any current functionality.
- **FR-003**: The change MUST be delivered as a Prisma migration (raw SQL via `prisma migrate diff`/a manual migration file) so it applies automatically via the existing `prisma migrate deploy` step in the build/deploy pipeline, consistent with how `RateLimitHit` was added in feature 016.
- **FR-004**: The migration MUST NOT alter table structure, data, indexes, or existing grants — RLS enablement only.
- **FR-005**: Post-migration, the application's full test suite MUST be run and pass with zero new failures, verifying the `BYPASSRLS` exemption holds in practice, not just by role-attribute inspection.
- **FR-006**: Post-migration, at least one table MUST be spot-checked live against the Data API (with the `anon` key, if the Data API is confirmed on at check time) to confirm the deny-by-default behavior empirically, not just via `pg_tables.rowsecurity`.
- **FR-007**: The spec/handoff documentation MUST record that `service_role` bypasses RLS unconditionally and must be handled with the same secrecy as a superuser DB credential, since this feature does not and cannot change that behavior.
- **FR-008**: The discrepancy between the dashboard's "Data API disabled" state and the live endpoint still responding as active MUST be documented as an open item with the evidence gathered (timestamps, responses), for follow-up independent of whether RLS ships.

### Key Entities

- **Table**: One of the 22 `public`-schema relations listed in FR-001. Attributes: name, current `rowsecurity` state (all `false` at spec time), post-migration target state (`true`), policies attached (none, by design).
- **Role**: A Postgres role relevant to access control. `postgres` (app/Prisma role, `BYPASSRLS=true`, unaffected by this change), `anon` (Data API unauthenticated key, `BYPASSRLS=false`, denied by default post-migration), `authenticated` (Data API logged-in-user key, `BYPASSRLS=false`, denied by default post-migration), `service_role` (Data API elevated key, `BYPASSRLS=true`, always bypasses regardless of this change — not used anywhere in this app today).
- **Migration**: The Prisma migration artifact delivering FR-001–FR-004.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the 22 `public`-schema tables report `rowsecurity = true` via `pg_tables` after the migration.
- **SC-002**: Zero policies exist on any of these tables post-migration (deny-by-default verified via `pg_policies` returning no rows for these tables).
- **SC-003**: The application's full test suite passes with zero new failures after the migration is applied.
- **SC-004**: A live spot-check against the Data API (when reachable) with the `anon` key against at least one table returns zero rows, empirically confirming default-deny.
- **SC-005**: The Data API on/off discrepancy is either resolved (endpoint confirmed genuinely disabled) or explicitly escalated/documented as an open follow-up, not silently dropped.

## Assumptions

- The `postgres` role's `BYPASSRLS` attribute (confirmed via `pg_roles` on 2026-07-28) remains unchanged going forward; if Supabase or a future operator ever revokes it, this would require the app's Prisma connection to instead need explicit permissive policies — a materially different, larger change not covered here.
- Disabling the Data API remains the intended primary control; this RLS change is additive defense-in-depth and does not depend on the Data API's on/off state to be effective.
- No current or near-term feature requires the Data API — if that changes, per-table policies for the specific feature's needs are designed and reviewed at that time, not spec'd speculatively now.
- `service_role` key is not currently stored in this repo's `.env`/`.env.example` and introducing it anywhere client-reachable is out of scope and would require its own security review.

## Out of Scope

- Writing granular, per-role access policies for any table (deny-all is the entire deliverable; the app doesn't use the Data API).
- Re-enabling or further configuring the Data API.
- Migrating any part of authentication, storage, or realtime functionality to Supabase's own services (this app uses NextAuth + Cloudflare R2, unaffected by this change).
- Resolving the Data API disable-toggle propagation itself (tracked as an open item per FR-008/SC-005, not a blocking dependency of this feature).
