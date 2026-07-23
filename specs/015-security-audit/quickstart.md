# Quickstart: Running the Pre-Launch Security Audit

How to execute the audit end-to-end and produce `report.md` + `coverage.md`. All steps are **read-only / non-destructive**. Nothing is committed and no application source is modified.

## Prerequisites
- Repo checked out at the commit to be audited (record its SHA for the report scope line).
- `pnpm`, `git`, `grep`/`rg`, `curl`, and `vercel` CLI available (all confirmed present).
- Optional: a deployed **staging/preview URL** for runtime checks (US-6). Without it, runtime controls become operator-verification items. On Vercel, get one via `vercel deployments ls` / `vercel inspect` or a preview deploy.
- Optional: test-account credentials for a benign authenticated staging request (never real user data).

## Steps (by audit area)

1. **Route inventory & authorization (US-2, P1)**
   - `find src/app/api -name route.ts` → list all 43 handlers.
   - For each exported method, trace to a gate in `src/lib/auth.ts` (`requireUser` / `requireVerifiedUser` / `requireAdmin`) or a secret check; for `[id]`/`[userId]`/`[themeId]` routes confirm the query filters by caller ownership (IDOR/BOLA).
   - Record one row per method in the route matrix (`contracts/coverage-matrix.md`). Any `UNGUARDED` or unscoped object route → Finding.

2. **Payment & credit integrity (US-3, P1)**
   - Read `src/app/api/webhooks/asaas/route.ts` + `src/modules/billing/**`: confirm the `asaas-access-token` gate covers all state changes, processing is idempotent, and credit debits are atomic/transactional (no read-then-write race).

3. **Secrets (US-4, P2)**
   - `grep -r` the tree and `git log -p -S<pattern>` the history for key shapes (Google/AWS/Anthropic/Asaas/Resend, `PRIVATE KEY`).
   - Confirm no server secret reaches the client (`NEXT_PUBLIC_*`, client components). Optional: `npx gitleaks detect` (installs nothing).

4. **Dependencies (US-5, P2)**
   - `pnpm audit --json` → record advisories (severity, fixed version). Flag `next-auth@5.0.0-beta.31` pre-release risk.

5. **Runtime hardening (US-6, P3)**
   - Static: confirm neither `next.config.ts` nor `vercel.json` sets a `headers` block (already observed — no security headers).
   - Staging: `curl -sI <staging-url>` for CSP/HSTS/X-Content-Type-Options/frame-ancestors/Referrer-Policy; check session cookie `Secure`/`HttpOnly`/`SameSite`; confirm HTTP→HTTPS; probe rate limits with a **small, bounded** number of requests to login/register/reset (no flooding).
   - Confirm dev stubs `fake-outbox` / `fake-upload[...key]` are gated out of production (read the handlers; check for env guard).

6. **Data exposure (US-1/US-6 cross-cut, FR-016)**
   - Cross-check that essay/PII-bearing endpoints from step 1 enforce ownership; note any that expose another user's content.

## Output
- Write findings to `report.md` per `contracts/report-format.md`.
- Write coverage to `coverage.md` per `contracts/coverage-matrix.md`.
- Fill the report `Verdict` from the launch-blocking set (any blocker ⇒ not GO).

## Guardrails (do not violate)
- No destructive/intrusive/DoS testing; `potential` findings get a verification step, not a live exploit (FR-013).
- No source edits to fix defects — recommendations only (FR-014).
- Only files under `specs/015-security-audit/` are written; no `git commit` by the audit.
