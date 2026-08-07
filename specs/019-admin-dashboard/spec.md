# Feature Specification: Admin Dashboard Overhaul

**Feature Branch**: `019-admin-dashboard`

**Created**: 2026-08-07

**Status**: Draft

**Input**: User description: "Admin dashboard overhaul. The current admin panel only has two pages: a weekly-theme manager and a bare metrics page showing total users, total submissions, and a users-by-plan table. Replace/extend it with a comprehensive admin dashboard covering four areas: (1) user search & detail with a credit-grant action, (2) revenue & subscriptions (MRR, plan mix, recent payments), (3) submission pipeline & grading health, (4) growth & activity trends (snapshot totals). Every admin action must be recorded in a new audit log."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a user and see their full history (Priority: P1)

An admin doing support/investigation work (e.g., "did this email actually submit an essay?", "why is this submission stuck?") searches for a user by email and sees, on one page, that user's submissions (with status, theme, and score), credit transaction history, subscription status, and email verification status — without writing a database query.

**Why this priority**: This is today's biggest gap. Answering "what happened with user X" currently requires an engineer to write and run ad-hoc scripts against the production database. It's the highest-frequency need and the riskiest to leave manual (direct DB access for routine support questions).

**Independent Test**: Can be fully tested by searching for a known user's email and confirming their submissions, credits, and subscription state render correctly, matching what a direct database query would show.

**Acceptance Scenarios**:

1. **Given** the admin is on the dashboard, **When** they search by a user's exact email, **Then** that user's detail page opens showing submissions, credit history, subscription, and verification status.
2. **Given** the admin enters a partial email, **When** multiple users match, **Then** a result list is shown so the admin can pick the right one.
3. **Given** the admin searches an email with no matching account, **When** the search runs, **Then** the dashboard shows a clear "no user found" state instead of an error.
4. **Given** a user has never submitted an essay, **When** the admin views their detail page, **Then** the submissions section shows an empty state rather than an error or blank page.

---

### User Story 2 - Grant a credit adjustment with an audit trail (Priority: P1)

From a user's detail page, an admin grants (or deducts) credits for that user — replacing the current manual-script workflow — and the action is permanently recorded with who did it, to whom, how much, and when.

**Why this priority**: Credit grants are the one write action admins already perform manually today (via script). Moving it into the dashboard removes the riskiest manual step (direct production script execution) and is only safe to ship alongside an audit trail, since it touches money-equivalent balances.

**Independent Test**: Can be fully tested by granting a credit adjustment to a test user from their detail page, confirming their credit balance updates immediately, and confirming an audit log entry exists recording the action.

**Acceptance Scenarios**:

1. **Given** the admin is on a user's detail page, **When** they submit a credit grant with an amount and a reason, **Then** the user's credit balance updates and a new non-expiring credit transaction is created.
2. **Given** a credit grant was just made, **When** the admin (or another admin) looks at that user's history, **Then** an audit entry is visible showing the acting admin, the amount, the reason, and the timestamp.
3. **Given** the admin submits a credit grant without an amount or reason, **When** they attempt to save, **Then** the action is rejected with a clear validation message and nothing is recorded.
4. **Given** the admin wants to correct an over-grant, **When** they submit a negative amount, **Then** the deduction is applied and logged the same way as a positive grant.

---

### User Story 3 - See revenue and subscription health at a glance (Priority: P2)

An admin views current monthly recurring revenue and how many active subscribers are on each plan tier, plus a chronological feed of recent payments, without running a manual query.

**Why this priority**: Revenue visibility is a recurring need (e.g., confirming a price migration took effect, sanity-checking subscriber counts) that today requires direct database access.

**Independent Test**: Can be fully tested by viewing the revenue section and confirming the MRR figure and per-tier subscriber counts match a direct count of active subscriptions, and that the recent-payments feed reflects the latest payment records.

**Acceptance Scenarios**:

1. **Given** there are active subscriptions on both plan tiers, **When** the admin opens the revenue section, **Then** they see an MRR estimate and a subscriber count broken down by tier.
2. **Given** recent payments exist, **When** the admin views the payments feed, **Then** the most recent payments are listed with amount, method, status, and the associated user.
3. **Given** a subscription is past_due or canceled, **When** MRR is calculated, **Then** that subscription is excluded from the MRR figure.

---

### User Story 4 - See submission pipeline and grading health (Priority: P3)

An admin views a breakdown of submissions by status (including stuck/expired/failed states), failure and zero-score reasons, and the score distribution across graded essays, to spot systemic problems without querying the database.

**Why this priority**: Useful for catching operational issues (e.g., a spike in failed OCR, an expiry-sweep problem) but lower frequency than user lookups or revenue checks.

**Independent Test**: Can be fully tested by viewing the pipeline section and confirming the status counts match a direct count of submissions grouped by status.

**Acceptance Scenarios**:

1. **Given** submissions exist in multiple statuses, **When** the admin views the pipeline section, **Then** they see a count for each status (pending, transcribing, awaiting_review, grading, completed, failed, expired).
2. **Given** some submissions failed or scored zero, **When** the admin views the section, **Then** they see a breakdown by failure reason and by zero-reason.
3. **Given** completed evaluations exist, **When** the admin views the section, **Then** they see the distribution of total scores across those evaluations.

---

### User Story 5 - See growth and activity snapshot (Priority: P4)

An admin views signup, submission, and email-verification counts for standard recent windows (last 24 hours, 7 days, 30 days, and all-time) to gauge activity level, without exporting data.

**Why this priority**: Lowest-frequency need of the four areas; useful context but not something admins currently work around manually.

**Independent Test**: Can be fully tested by viewing the growth section and confirming the counts for each time window match direct counts of records created in that window.

**Acceptance Scenarios**:

1. **Given** users have signed up at various times, **When** the admin views the growth section, **Then** signup counts are shown for the last 24h, 7d, 30d, and all-time.
2. **Given** submissions and verifications have occurred at various times, **When** the admin views the growth section, **Then** the same time-window breakdown is shown for submissions and verifications.

---

### Edge Cases

- What happens when an admin searches for a soft-deleted/anonymized account? It is excluded from search results by default, since its data has been anonymized for retention purposes.
- What happens when two admins grant credits to the same user at nearly the same time? Both actions apply and are both recorded as separate audit entries; no locking is required since credit transactions are already additive, immutable rows.
- How does the system handle a user with a subscription but zero payments (e.g., subscription created but first payment still pending)? The subscription still counts toward the plan-mix breakdown; MRR only counts subscriptions with `active` status regardless of payment history.
- How does the dashboard handle an admin submitting a credit grant of zero? It is rejected the same way as a missing amount — zero has no effect and would create a meaningless audit entry.
- What happens when there are more search results than fit on screen? Results are capped at a reasonable number (e.g., 20) with a prompt to refine the search further.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Admins MUST be able to search for a user by email (exact or partial match, case-insensitive) from the dashboard.
- **FR-002**: When a search matches exactly one user, the system MUST open that user's detail page directly; when it matches multiple, it MUST show a selectable list.
- **FR-003**: A user's detail page MUST show their submissions (theme, status, score when available, and date).
- **FR-004**: A user's detail page MUST show their credit transaction history (kind, amount, date).
- **FR-005**: A user's detail page MUST show their subscription status (plan tier, status, current billing period) when one exists, or a clear "no subscription" state when none exists.
- **FR-006**: A user's detail page MUST show email verification status.
- **FR-007**: Admins MUST be able to grant or deduct credits for a user from their detail page, providing an amount and a reason.
- **FR-008**: The system MUST reject a credit grant that has no amount, a zero amount, or no reason.
- **FR-009**: Credit grants issued from the dashboard MUST be recorded as non-expiring credit transactions, consistent with existing manual-grant behavior.
- **FR-010**: The system MUST record every admin action (starting with credit grants) in an audit log capturing the acting admin, the action type, the target user, the action details (e.g., amount and reason), and the timestamp.
- **FR-011**: A user's detail page MUST show the audit history of actions taken on that user.
- **FR-012**: The dashboard MUST show current MRR, calculated from subscriptions with `active` status at their plan's current price.
- **FR-013**: The dashboard MUST show subscriber counts broken down by plan tier and by subscription status (active, past_due, canceled, expired).
- **FR-014**: The dashboard MUST show a chronological feed of recent payments with amount, method, status, and associated user.
- **FR-015**: The dashboard MUST show submission counts broken down by status.
- **FR-016**: The dashboard MUST show a breakdown of submission failure reasons and evaluation zero-reasons.
- **FR-017**: The dashboard MUST show the distribution of total scores across completed evaluations.
- **FR-018**: The dashboard MUST show signup, submission, and email-verification counts for the last 24 hours, 7 days, 30 days, and all-time.
- **FR-019**: All dashboard pages and actions MUST remain restricted to users with the admin role, using the existing admin access gate.

### Key Entities

- **Admin Action Log** *(new)*: Records an administrative action taken from the dashboard — which admin performed it, what type of action, which user it targeted, action-specific details (e.g., credit amount and reason), and when it happened. Starts with credit-grant actions; designed to record future admin actions as they're added.
- **User, Submission, Evaluation, CreditTransaction, Subscription, SubscriptionPlan, PaymentTransaction** *(existing)*: The dashboard reads and, for CreditTransaction, writes to these existing records; no changes to their structure are required by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can find any user's complete activity history (submissions, credits, subscription, verification) by searching their email, with no direct database access required.
- **SC-002**: An admin can complete a credit grant for a user, from search to confirmation, in under 30 seconds.
- **SC-003**: 100% of credit-grant actions taken through the dashboard produce a retrievable audit entry with actor, target, amount, reason, and timestamp.
- **SC-004**: An admin can view current MRR and per-tier subscriber counts without running a manual query.
- **SC-005**: An admin can assess submission pipeline health (status counts, failure/zero-reason breakdown, score distribution) from a single page view.
- **SC-006**: An admin can see 24h/7d/30d/all-time activity counts for signups, submissions, and verifications from a single page view.

## Assumptions

- The existing single `admin` role is sufficient for this feature; no new permission tiers or per-section access control are introduced.
- v1 ships snapshot totals for all metrics; time-series charts are explicitly out of scope and deferred to a future iteration.
- Credit granting is the only write action in v1. Other admin actions considered during scoping — resending/force-verifying email, managing subscriptions, suspending accounts — are out of scope for this feature and may be added later, each extending the same audit log.
- MRR is an estimate (active subscriptions × current plan price); it does not model proration, discounts, or mid-cycle changes.
- The audit log is surfaced per-user (on that user's detail page) in v1. A global, cross-user audit log view is out of scope for v1.
- Soft-deleted/anonymized user accounts are excluded from search results by default, consistent with existing data-retention handling for deleted accounts.
