# Feature Specification: Pre-Launch Security Audit

**Feature Branch**: `015-security-audit`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "Security vulnerability assessment of the Argos ENEM web application before pointing a real production domain at it. Audit the application's security posture across code, dependencies, and runtime: authentication/authorization enforcement (no middleware.ts, so per-route session+role checks), payment webhook signature verification (Asaas), admin and cron endpoint protection, IDOR/broken-object-level-authorization on submissions/groups/billing, credit-spend race conditions, file-upload (S3 presigned URL) scoping, secret exposure, dependency CVEs (next-auth beta, Next 15), removal/disabling of dev stub routes (fake-outbox, fake-upload) in production, and standard runtime hardening (security headers, cookie flags, rate limiting, HTTPS). Deliverable is a prioritized findings report with remediation guidance; no destructive testing."

## Overview

The Argos ENEM web application is about to be connected to a real, publicly reachable production domain. Before that exposure, the team needs confidence that the application does not carry exploitable security defects that could lead to account takeover, unauthorized access to student essays and personal data, financial fraud through the payment/credit system, or leakage of third-party API credentials. This feature is a **structured, read-only security assessment** of the application's current state whose sole deliverable is a **prioritized findings report with actionable remediation guidance**. It does not itself fix defects and performs no destructive or intrusive testing.

## Clarifications

### Session 2026-07-23

- Q: What severity scale should findings use in the report? → A: 4-tier (Critical / High / Medium / Low) plus an explicit launch-blocking (yes/no) flag per finding.
- Q: How should runtime controls (security headers, cookie flags, HTTPS, rate limiting) be verified, given the audit is read-only? → A: Inspect an already-deployed staging/preview URL (non-destructively); controls not confirmable there fall back to operator-verification items.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trustworthy go/no-go decision for launch (Priority: P1)

As the person responsible for launching the site, I need a single prioritized report that tells me which security defects exist and how severe each one is, so I can decide whether it is safe to point the real domain at the application and know exactly what must be fixed first.

**Why this priority**: This is the entire reason the audit exists. Without a severity-ranked, decision-ready report, the audit produces no value and the launch decision remains a guess.

**Independent Test**: Can be fully tested by producing the report and confirming a reviewer can, using only the report, identify every launch-blocking issue and the order in which to fix them — without reading the source code themselves.

**Acceptance Scenarios**:

1. **Given** the audit is complete, **When** the report is opened, **Then** every finding carries a severity rating, the affected area, a concrete description of the risk, and a specific remediation recommendation.
2. **Given** the report contains findings, **When** a reader scans it top to bottom, **Then** findings are ordered by severity so the most launch-critical issues appear first.
3. **Given** no defect is found in an audited area, **When** the report is read, **Then** that area is explicitly recorded as "reviewed, no issue found" rather than silently omitted.

---

### User Story 2 - Authentication & authorization coverage (Priority: P1)

As the owner of a multi-tenant app holding student data and money, I need assurance that every protected route actually enforces authentication and the correct role/ownership, because there is no global middleware guard and each route must enforce access on its own.

**Why this priority**: A single unguarded admin, billing, cron, or object-scoped route is a full compromise of other users' data or funds. This is the highest-likelihood, highest-impact class of defect for this codebase.

**Independent Test**: Can be tested by enumerating every non-public server route and confirming, per route, that the report states whether it requires a session, enforces the correct role, and scopes data access to the requesting user.

**Acceptance Scenarios**:

1. **Given** the set of server routes, **When** the audit runs, **Then** every route is classified as public-by-design or protected, and each protected route's enforcement is confirmed present or flagged as missing.
2. **Given** a route that operates on a user-owned object (submission, group, billing record), **When** it is audited, **Then** the report states whether a non-owner can read or mutate that object (broken object-level authorization).
3. **Given** an admin-only or cron-only route, **When** it is audited, **Then** the report confirms it rejects unauthenticated or unauthorized callers.

---

### User Story 3 - Money & credit integrity (Priority: P1)

As the operator of the billing and credit system, I need assurance that payment webhooks cannot be forged and that credits cannot be duplicated or spent more than once through concurrent requests, so that no user can obtain paid features or credits without paying.

**Why this priority**: Defects here translate directly into financial loss and are attractive, low-skill targets once the domain is public.

**Independent Test**: Can be tested by reviewing the payment webhook handler and credit-spend paths and confirming the report states whether webhook authenticity is verified and whether concurrent spends are prevented.

**Acceptance Scenarios**:

1. **Given** the incoming payment/subscription webhook endpoint, **When** it is audited, **Then** the report states whether the sender's authenticity is verified before any credit or subscription state changes, and flags it if not.
2. **Given** the credit-spending flow, **When** it is audited, **Then** the report states whether two simultaneous requests could spend the same credit twice, and flags any missing safeguard.

---

### User Story 4 - Secret & credential exposure (Priority: P2)

As the holder of third-party API keys (essay grading, OCR, email, storage, payments), I need confirmation that no secret is committed to the repository, exposed to the browser, or otherwise leakable, so that going public does not hand attackers our credentials.

**Why this priority**: Leaked keys mean direct financial abuse of paid third-party services and potential data access, but this is a narrower blast radius than an open auth hole.

**Independent Test**: Can be tested by scanning the repository and its history plus client-exposed surfaces and confirming the report lists any secret that is reachable.

**Acceptance Scenarios**:

1. **Given** the repository and its commit history, **When** scanned, **Then** the report identifies any committed credential or confirms none are present.
2. **Given** the application's client-delivered code and configuration, **When** audited, **Then** the report confirms no server-only secret is exposed to the browser.

---

### User Story 5 - Dependency & known-vulnerability review (Priority: P2)

As the maintainer, I need to know whether any third-party package in use has a known published vulnerability, and whether any pre-release/beta dependency in a security-sensitive role is a risk, so those can be addressed before launch.

**Why this priority**: Known CVEs are cheap to find and cheap to exploit once public, but most are addressed by an upgrade and are lower-effort to remediate than logic flaws.

**Independent Test**: Can be tested by running a dependency vulnerability check and confirming the report lists each known-vulnerable package with its severity and fixed version.

**Acceptance Scenarios**:

1. **Given** the dependency set, **When** audited, **Then** every dependency with a known published vulnerability is listed with severity and the version that resolves it.
2. **Given** a security-critical dependency on a pre-release/beta version, **When** audited, **Then** the report notes the pre-release status and its risk implication.

---

### User Story 6 - Runtime hardening & production surface (Priority: P3)

As the person configuring the production deployment, I need to know whether standard protections are in place — security response headers, secure session cookie flags, HTTPS enforcement, rate limiting on abuse-prone endpoints — and whether any development-only stub routes would ship to production, so the live surface is minimally exposed.

**Why this priority**: These reduce exploitability and blast radius and matter for launch, but individually tend to be lower severity than a direct auth or payment flaw; they are grouped as hardening.

**Independent Test**: Can be tested by inspecting the deployed staging/preview URL's actual responses plus the route inventory, and confirming the report states the presence or absence of each hardening control (falling back to an operator-verification item where staging cannot confirm it) and flags any dev-only route reachable in production.

**Acceptance Scenarios**:

1. **Given** the production response configuration, **When** audited, **Then** the report states whether standard security headers, secure/httpOnly/sameSite session cookie flags, and HTTPS enforcement are present.
2. **Given** abuse-prone endpoints (login, registration, password reset, submission), **When** audited, **Then** the report states whether request-rate limiting protects them.
3. **Given** development/test stub routes exist in the codebase, **When** audited, **Then** the report flags any that would be reachable in a production build and recommends disabling them.

---

### Edge Cases

- **A route's protection depends on runtime configuration** (e.g., an environment flag that disables a stub): the report must state the condition under which the route is exposed, not just its default.
- **A finding cannot be confirmed without intrusive testing**: it is recorded as a *potential* finding with the reasoning and the verification step needed, rather than being asserted or dropped — no destructive test is run to prove it.
- **An area is out of reach of a read-only review** (e.g., a control that only exists at the hosting/CDN layer not represented in the repo): the report states the limitation and what the operator must verify manually.
- **A dependency vulnerability has no fix available yet**: the report records it with a recommended mitigation or accepted-risk note rather than an upgrade that does not exist.
- **The same root cause produces many symptoms** (e.g., a missing shared guard affecting many routes): the report groups them under one finding to keep remediation actionable, while listing every affected route.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The audit MUST produce a single written findings report as its deliverable, stored in the repository alongside this feature's artifacts.
- **FR-002**: Every finding MUST include: a severity rating on a 4-tier scale (Critical / High / Medium / Low), an explicit launch-blocking flag (yes/no), the affected component/area, a description of the risk and how it could be exploited, and a specific remediation recommendation.
- **FR-003**: Findings MUST be ordered by severity, most severe first, and the report MUST present an at-a-glance summary that lists the launch-blocking findings (those with the launch-blocking flag set) separately from the rest.
- **FR-004**: The audit MUST enumerate every server route and classify each as public-by-design or protected; for each protected route it MUST record whether authentication, role enforcement, and per-user object scoping are present.
- **FR-005**: The audit MUST evaluate object-owning operations (submissions, groups, billing) for broken object-level authorization (whether a non-owner can read or mutate another user's object).
- **FR-006**: The audit MUST evaluate the payment/subscription webhook endpoint for verification of sender authenticity before any state change.
- **FR-007**: The audit MUST evaluate credit-spending and other value-changing flows for concurrency defects that could allow double-spending.
- **FR-008**: The audit MUST scan the repository, its commit history, and client-delivered surfaces for exposed secrets/credentials.
- **FR-009**: The audit MUST identify dependencies with known published vulnerabilities, reporting severity and the resolving version, and MUST note security-critical pre-release dependencies.
- **FR-010**: The audit MUST report on runtime hardening controls: security response headers, session cookie flags, HTTPS enforcement, and rate limiting on abuse-prone endpoints. These controls MUST be verified non-destructively against a deployed staging/preview URL when one is available; any control that cannot be confirmed there MUST be reported as an operator-verification item (per FR-015).
- **FR-011**: The audit MUST flag any development/test stub route that would be reachable in a production build and recommend its removal or gating.
- **FR-012**: For every audited area in which no defect is found, the report MUST explicitly record it as reviewed with no issue, so coverage is visible.
- **FR-013**: The audit MUST NOT perform destructive, intrusive, or disruptive testing; any finding that would require such testing to confirm MUST be reported as a *potential* finding with the verification step needed.
- **FR-014**: The audit MUST NOT modify application source code to fix defects; remediation is delivered as recommendations only. (Producing the report and audit artifacts under this feature's directory is permitted.)
- **FR-015**: The report MUST record the scope actually covered and any limitations (areas that a read-only review or the current environment could not verify), so the reader knows what remains their responsibility to check.
- **FR-016**: The audit MUST assess handling of user personal data and student essay content for unauthorized exposure consistent with the object-level authorization checks above.

### Key Entities *(include if feature involves data)*

- **Finding**: A single identified issue. Attributes: identifier, title, severity (Critical / High / Medium / Low), launch-blocking flag (yes/no), affected area/route, risk description, exploit/impact summary, remediation recommendation, confirmation status (confirmed vs. potential), and affected-item list when grouped.
- **Audited Area**: A distinct scope of review (e.g., authorization, payment integrity, secrets, dependencies, runtime hardening). Attributes: name, coverage status, and outcome (findings vs. no-issue-found vs. not-verifiable).
- **Findings Report**: The deliverable aggregating all findings and audited areas, plus a prioritized summary, scope statement, and stated limitations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of non-public server routes are individually accounted for in the report as either protected-and-verified or flagged.
- **SC-002**: Every finding in the report has a severity and a specific remediation recommendation — zero findings with "TODO"/unspecified remediation.
- **SC-003**: A reader who has never seen the codebase can, using only the report, list every launch-blocking issue and the order to fix them.
- **SC-004**: All six audited areas (authorization, payment/credit integrity, secrets, dependencies, runtime hardening, data exposure) appear in the report with an explicit coverage outcome — none silently missing.
- **SC-005**: Zero destructive or intrusive tests are performed and zero application source files are modified to fix defects during the audit.
- **SC-006**: After the recommended launch-blocking fixes are applied, a re-check of those specific findings confirms each is resolved (the report is actionable enough to verify closure).

## Assumptions

- The audit is authorized by the application owner on an application they own; this is a defensive, pre-launch self-assessment.
- The review is primarily static/read-only against the current working tree and repository history; runtime checks are limited to non-destructive inspection of configuration and observed responses, not live exploitation.
- Runtime hardening controls (US-6) are verified against a deployed staging/preview URL, which the operator provides; if no staging URL is available, those controls are downgraded to operator-verification items rather than left unassessed.
- Severity uses a 4-tier scale (Critical / High / Medium / Low) with a separate launch-blocking flag, so a lower-severity issue can still be marked launch-blocking (and vice versa) based on the go/no-go decision context.
- The technology stack is the existing one (Next.js app with session-based auth, Prisma data layer, external payment provider, cloud object storage, and third-party AI/OCR/email services); no change to the stack is in scope.
- Fixing the identified defects is a **separate** effort; this feature ends at a validated, prioritized report. Remediation may be planned as its own follow-up.
- Severity is assessed by likelihood × impact in the context of a public production launch (data exposure, account takeover, and financial abuse weigh highest).
- Infrastructure controls that live outside the repository (hosting platform, CDN, WAF, DNS/TLS termination) are assessed only to the extent they are represented in code/configuration; anything not represented is listed as an operator-verification item.

## Out of Scope

- Implementing the fixes for identified findings (tracked separately).
- Penetration testing, denial-of-service testing, fuzzing, or any live-exploitation against a running environment.
- Third-party providers' own internal security posture (Asaas, Google, storage, email); only this application's integration with them is in scope.
- Formal compliance certification (e.g., LGPD/GDPR legal sign-off); privacy is considered only through the technical lens of unauthorized data exposure.
