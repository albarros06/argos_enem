# Phase 1 Data Model: Pre-Launch Security Audit

The "data" here is the structure of the audit's own records. These entities define the shape of `report.md` and `coverage.md`. No database or application data is involved.

## Entity: Finding

A single identified issue.

| Field | Type / Values | Notes |
|---|---|---|
| `id` | `SEC-001`, `SEC-002`, … | Stable, sequential; referenced by the coverage matrix and any re-check. |
| `title` | short string | One-line defect name. |
| `severity` | `Critical` \| `High` \| `Medium` \| `Low` | Per the rubric below. |
| `launch_blocking` | `yes` \| `no` | **Independent** of severity — a Low can be blocking, a High may not be. |
| `area` | one of the six audited areas | authorization \| payment-credit \| secrets \| dependencies \| runtime-hardening \| data-exposure. |
| `location` | `file:line` or request/response | Exact anchor so the finding is re-checkable (SC-006). For runtime findings, the exact URL + observed header/response. |
| `risk` | prose | What is wrong. |
| `impact` | prose | What an attacker gains / what breaks in a public launch. |
| `remediation` | prose | Specific, actionable fix (no "TODO"). |
| `confirmation` | `confirmed` \| `potential` | `potential` when confirming would need intrusive testing (FR-013); include the verification step. |
| `affected_items` | list | When one root cause spans many routes/files, list them all under the single finding (FR-003 grouping). |

### Validation rules
- Every Finding MUST have all fields; `remediation` MUST be non-empty and specific (SC-002).
- A `potential` finding MUST include the non-destructive verification step a reviewer can later run.
- Grouped findings MUST list every affected item rather than emitting duplicate near-identical findings.

## Entity: AuditedArea

A distinct scope of review; guarantees coverage is visible (FR-012).

| Field | Type / Values | Notes |
|---|---|---|
| `name` | the six areas | Fixed set. |
| `coverage` | `covered` \| `partial` \| `not-verifiable` | `not-verifiable` = out of reach of read-only review / no staging URL. |
| `outcome` | `findings` \| `no-issue-found` \| `operator-verification-required` | `no-issue-found` MUST be stated explicitly, not implied by omission. |
| `finding_ids` | list of `SEC-###` | Empty when `no-issue-found`. |
| `notes` | prose | Limitations, operator-verification items, method caveats. |

## Entity: RouteAuthzRecord

One row per HTTP method per route handler — the evidence behind US-2 / SC-001.

| Field | Type / Values | Notes |
|---|---|---|
| `route` | path, e.g. `/api/submissions/[id]` | From the 43-handler inventory. |
| `method` | `GET`/`POST`/`PATCH`/`DELETE`/… | One record per exported method. |
| `classification` | `public-by-design` \| `session` \| `verified-session` \| `admin` \| `secret-token` \| `UNGUARDED` | `UNGUARDED` ⇒ a Finding. |
| `object_scoped` | `yes` \| `no` \| `n/a` | For `[id]`-style routes: does the query filter by caller ownership? `no` on a protected object route ⇒ IDOR Finding. |
| `evidence` | `file:line` | The guard call (or its absence). |

### Validation rules
- 100% of non-`public-by-design` routes accounted for (SC-001): every handler appears as ≥1 record.
- Any `UNGUARDED`, or `object_scoped = no` on a protected object route, MUST have a corresponding Finding.

## Entity: FindingsReport (the deliverable)

Aggregates the above into `report.md` (see `contracts/report-format.md`) with:
- a prioritized summary separating launch-blocking findings from the rest (FR-003),
- all Findings ordered by severity then blocking flag,
- a scope statement and explicit limitations (FR-015),
- a link to `coverage.md` (the AuditedArea + RouteAuthzRecord matrices).

## Severity & launch-blocking rubric

Severity = likelihood × impact in a **public-launch** context.

| Severity | Definition | Typical examples in this app |
|---|---|---|
| **Critical** | Trivially exploitable → account takeover, another user's data/essays, or funds/credits. | Unguarded route exposing/mutating another user's object; forgeable payment webhook; live secret committed or shipped to browser. |
| **High** | Exploitable with modest effort or conditions → serious data/financial impact. | IDOR needing a guessed id; credit double-spend race; high-severity CVE with known exploit; `trustHost` host-injection if exploitable. |
| **Medium** | Real weakness, limited impact or needs preconditions. | Missing security headers; medium CVE; dev stub reachable but low-value; missing rate limit on a costly endpoint. |
| **Low** | Hardening gap / defense-in-depth. | Missing `Referrer-Policy`; verbose errors; stale security-relevant comment (e.g., the `não Vercel` comment) with no direct exploit. |

**launch-blocking** (separate flag): set `yes` when the issue must be fixed before pointing the real domain at the app, regardless of tier — anything enabling unauthorized access to data/funds is `yes`; a Low stale comment is `no`; a Medium missing-header set may be `yes` if it materially raises exploitability of the now-public surface.
