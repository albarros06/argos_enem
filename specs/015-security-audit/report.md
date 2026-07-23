# Pre-Launch Security Audit — Argos ENEM

**Date**: 2026-07-23
**Scope**: commit `163efe598f09e7478d61c21e67a97e1a391c8225` (branch `015-security-audit`) · staging inspected: `https://argos-enem.vercel.app`
**Auditor**: Claude (Claude Code), read-only static + non-destructive runtime review
**Verdict**: **NO-GO until launch-blocking items resolved** — the app's *authorization and money logic are solid*, but 5 launch-blocking issues (all quick to fix: 2 dependency bumps, missing security headers, and login brute-force protection) must be closed before pointing a real domain at it.

> **Good news first**: the highest-risk classes for this kind of app — broken object-level authorization (IDOR), credit double-spend, forgeable payment webhooks, committed secrets, and unguarded admin/cron routes — were all **reviewed and found clean**. See "Reviewed — no issue found" below. The blockers are hardening + dependency currency, not broken core logic.

## Launch-Blocking Summary

| ID | Severity | Title | Area | Fix effort |
|----|----------|-------|------|-----------|
| SEC-001 | High | Login endpoint has no brute-force / rate-limit protection | runtime-hardening | Low |
| SEC-002 | Critical* | `next-auth` on a beta with 3 critical + several high Auth.js advisories | dependencies | Low (upgrade) |
| SEC-003 | High | `next` 15.5.19 has known SSRF + unauthenticated-disclosure advisories | dependencies | Low (upgrade) |
| SEC-004 | Medium | In-memory rate limiter is ineffective on Vercel serverless | runtime-hardening | Medium |
| SEC-005 | Medium | No security response headers (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) | runtime-hardening | Low |

*SEC-002 is rated by the upstream advisory severity (Critical); its concrete exploitability here depends on which Auth.js code paths are used — see the finding.

**Recommended pre-launch order**: SEC-002 + SEC-003 + SEC-006 in one `pnpm update` pass → SEC-005 (add a `headers()` block) → SEC-001 + SEC-004 (rate-limit the login on a shared store).

## All Findings (severity-ordered)

### SEC-002 — `next-auth` beta carries 3 critical + multiple high Auth.js advisories
- **Severity**: Critical · **Launch-blocking**: yes · **Confirmation**: confirmed
- **Area**: dependencies
- **Location**: `package.json` → `next-auth@5.0.0-beta.31` (and transitive `@auth/core`); `pnpm audit`
- **Risk**: `pnpm audit` reports for `next-auth`/`@auth/core`: *"Configuration errors can cause…"* auth issues, an email-normalizer validation-order flaw, and `getToken()` throwing an uncaught exception (DoS) — 3 critical + high advisories. Patched in `next-auth >= 5.0.0` (stable) and `@auth/core >= 0.41.3`; the app runs a pre-`5.0.0` beta.
- **Impact**: This is the authentication core of a public app holding student PII and payment state. Auth-config/normalization flaws can lead to auth bypass or account confusion; the `getToken()` crash is a DoS vector.
- **Remediation**: Upgrade to `next-auth@^5.0.0` (stable) and ensure `@auth/core >= 0.41.3`; re-run the auth integration tests and a manual login/reset/verify smoke test after upgrade. Re-run `pnpm audit` to confirm the Auth.js advisories clear.
- **Verification (re-check)**: `pnpm audit | grep -i auth` returns no critical/high after upgrade.

### SEC-001 — Login endpoint has no brute-force / rate-limit protection
- **Severity**: High · **Launch-blocking**: yes · **Confirmation**: confirmed
- **Area**: runtime-hardening (authN)
- **Location**: `src/lib/auth.ts` — NextAuth `Credentials.authorize` (≈ lines 18-30); contrast with `src/app/api/auth/{register,forgot-password,resend-verification}/route.ts` which *do* call `assertRateLimit`.
- **Risk**: The credentials login path applies **no** rate limiting or lockout. Registration, password-reset, and resend are throttled, but the actual password-guessing endpoint is not. Combined with an 8-character minimum password policy (SEC-007), an attacker can attempt unlimited passwords against any known email.
- **Impact**: Credential-stuffing / brute-force → account takeover of student and admin accounts once the domain is public. (The owner account's password shared during this audit, `senha123`, is exactly the kind of weak password this exposes — rotate it.)
- **Remediation**: Throttle the login by `email + IP` (e.g., N attempts/window with exponential backoff or temporary lockout), backed by a **shared** store (see SEC-004 — an in-memory limiter won't hold on Vercel). Consider a generic "invalid credentials" response time to avoid user enumeration, and optional CAPTCHA after repeated failures.
- **Verification (re-check)**: repeated failed logins for one email begin returning `429`/lockout within the configured threshold.

### SEC-003 — `next` 15.5.19 has known SSRF + unauthenticated-disclosure advisories
- **Severity**: High · **Launch-blocking**: yes · **Confirmation**: confirmed
- **Area**: dependencies
- **Location**: `package.json` → `next@^15.5.19`; `pnpm audit` (Paths `.>next`)
- **Risk**: `pnpm audit` flags multiple `next` advisories patched in `>= 15.5.21`: **SSRF in Server Actions**, **SSRF in rewrites**, **unauthenticated disclosure of internal Server** responses, cache confusion of response bodies, and DoS (App Router / image optimization). The pinned `^15.5.19` resolves below the patched line.
- **Impact**: SSRF and unauthenticated internal-response disclosure are directly reachable on a public deployment and can expose internal endpoints/metadata or pivot into the network.
- **Remediation**: Upgrade `next` to `>= 15.5.21` (`pnpm update next`), redeploy, re-run `pnpm audit`. Verify the app builds and core flows pass.
- **Verification (re-check)**: `pnpm audit | grep -i "next:"` shows no high/moderate after upgrade.

### SEC-006 — `sharp`/libvips high-severity advisory in the image pipeline
- **Severity**: High · **Launch-blocking**: no · **Confirmation**: confirmed
- **Area**: dependencies
- **Location**: `pnpm audit` Paths `.>next>sharp`; patched `>= 0.35.0`
- **Risk**: `sharp` inherits libvips vulnerabilities. Uploaded essay images flow through the OCR/image pipeline, so a malicious image could reach a vulnerable decode path.
- **Impact**: Potential crash / memory issue on processing attacker-supplied images. Transitive via `next`, so the SEC-003 upgrade may pull a fixed `sharp`; confirm.
- **Remediation**: After the `next` bump, run `pnpm why sharp` / `pnpm update sharp` to ensure `>= 0.35.0`.
- **Verification (re-check)**: `pnpm ls sharp` shows `>= 0.35.0`.

### SEC-004 — In-memory rate limiter is ineffective on Vercel serverless
- **Severity**: Medium · **Launch-blocking**: yes · **Confirmation**: confirmed
- **Area**: runtime-hardening
- **Location**: `src/lib/rateLimit.ts` — `assertRateLimit` stores buckets in `globalThis.rateBuckets` (a `Map`).
- **Risk**: On Vercel, requests are served by multiple, ephemeral serverless instances. An in-process `Map` is per-instance and resets on cold start, so limits (`register`, `forgot-password`, `resend-verification`) reset frequently and can be bypassed by spreading requests across instances. This also undermines any login throttle added for SEC-001 if built on the same primitive.
- **Impact**: The only abuse controls in the app are largely non-functional in production → enables the brute-force (SEC-001), reset-spam, and registration-abuse the limiter was meant to stop.
- **Remediation**: Back the limiter with a shared store (Vercel KV / Upstash Redis / a Postgres table with a windowed count), or enforce at the edge (Vercel WAF / middleware). Keep the same `assertRateLimit` interface but swap the backing store.
- **Verification (re-check)**: limits hold across repeated requests that land on different instances (observe stable `429` behavior in production).

### SEC-005 — No security response headers
- **Severity**: Medium · **Launch-blocking**: yes · **Confirmation**: confirmed (static + staging)
- **Area**: runtime-hardening
- **Location**: `next.config.ts` (no `headers()`), `vercel.json` (no `headers`); confirmed on staging: `curl -sI https://argos-enem.vercel.app/` and `/api/billing/plans` return **no** CSP / `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy`.
- **Risk**: No `X-Frame-Options`/`frame-ancestors` → clickjacking; no `X-Content-Type-Options: nosniff` → MIME sniffing; no CSP → no defense-in-depth against injected scripts; no `Referrer-Policy`/`Permissions-Policy`. (HSTS **is** present and HTTP→HTTPS 308 redirect works — those are fine.)
- **Impact**: Increases exploitability of any XSS and enables clickjacking of authenticated actions on a public site.
- **Remediation**: Add a `headers()` block in `next.config.ts` (or `vercel.json`) applying to all routes: `Content-Security-Policy` (start report-only, then enforce), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimizing unused features.
- **Verification (re-check)**: `curl -sI https://<domain>/` shows all five headers.

### SEC-007 — Weak password policy (8-char minimum, no complexity/breach check)
- **Severity**: Low · **Launch-blocking**: no · **Confirmation**: confirmed
- **Area**: runtime-hardening (authN)
- **Location**: `src/modules/auth/index.ts:15,18` — `z.string().min(8)`
- **Risk**: An 8-character minimum with no complexity or breached-password check accepts weak passwords (e.g., `senha123`). Amplifies SEC-001/SEC-004.
- **Impact**: Weak passwords + (currently) no login throttle = realistic account takeover.
- **Remediation**: Raise the floor (e.g., 10–12) or add a zxcvbn-style strength check / HIBP breached-password lookup; encourage passphrases. Primarily valuable once SEC-001 is fixed.
- **Verification (re-check)**: registration rejects a known-weak password.

### SEC-008 — Stale/incorrect security comment + `trustHost` on the wrong platform assumption
- **Severity**: Low · **Launch-blocking**: no · **Confirmation**: confirmed
- **Area**: platform-config
- **Location**: `src/lib/auth.ts` — comment "Servidor Linux próprio atrás de proxy reverso (não Vercel)" with `trustHost: true`, while the app is Vercel-hosted (`.vercel/`, `vercel.json` Cron).
- **Risk**: The comment documents the wrong deployment model, and `trustHost: true` trusts the incoming Host header. Bounded here because `APP_URL` is the intended canonical host — but this must be verified, since host-header trust can poison absolute links (e.g., password-reset URLs) if any code derives links from the request host instead of `APP_URL`.
- **Impact**: Low if all absolute links use `APP_URL`; otherwise host-header-injection-assisted phishing on reset/verify links.
- **Remediation**: Correct the comment; confirm password-reset/verify emails build links from `APP_URL`, not the request host. Consider `trustHost` implications explicitly for Vercel.
- **Verification (re-check)**: grep the email/link builders confirm `APP_URL` usage; comment updated.

### SEC-009 — Build/dev-only dependency advisories
- **Severity**: Low · **Launch-blocking**: no · **Confirmation**: confirmed
- **Area**: dependencies
- **Location**: `pnpm audit` — `postcss` (high, `>=8.5.12`), `esbuild` (low, dev-server, `>=0.28.1`), `brace-expansion` (high, DoS), `js-yaml` (high, `>=4.3.0`), `protobufjs` (moderate, via `@google-cloud/vision`).
- **Risk**: These are predominantly build/test/tooling-time (eslint, tsx, vitest, postcss) or deep transitive deps not on the production request hot path. `protobufjs` rides the Google Vision client (server-side) — worth updating.
- **Impact**: Low production-runtime exposure; mostly CI/dev integrity and DoS-on-malformed-input in tooling.
- **Remediation**: Fold into the same upgrade pass (`pnpm update`); update `@google-cloud/vision` to pull patched `protobufjs`. Re-run `pnpm audit`.
- **Verification (re-check)**: `pnpm audit` residual set shrinks to accepted low/dev-only items.

## Reviewed — no issue found (explicit coverage, FR-012)

- **Object-level authorization (IDOR/BOLA)** — CLEAN. Every object-scoped route enforces ownership in the module layer: `getSubmissionView` rejects `submission.userId !== userId` (404); `abandonSubmission`/`markUploaded` use `ownedSubmission`; group mutations (`removeMember`, `deleteGroup`, `regenerateInvite`) go through `requireGroupLeader` (`src/modules/groups/group.ts:117`).
- **Credit double-spend (concurrency)** — CLEAN. `consumeCredit` (`src/modules/credits/index.ts:61`) runs inside `prisma.$transaction` with a **per-user Postgres advisory lock** (`pg_advisory_xact_lock(hashtext(userId))`), serializing concurrent submissions; `refundCredit` is idempotent.
- **Payment webhook forgery** — CLEAN. `/api/webhooks/asaas` verifies the `asaas-access-token` shared secret before any state change and fails closed if the token is unset; processing is idempotent via `webhookEvent` (event id as primary key) and `paymentTransaction.upsert`.
- **Admin & cron authorization** — CLEAN. All `/api/admin/*` routes call `requireAdmin` (role check); `/api/cron/sweep` requires `Bearer CRON_SECRET` and fails closed if unset.
- **Secret exposure** — CLEAN. No secrets committed (only `.env.example`); `.env*` is gitignored; no secret blobs in git history; the sole key-shaped match is a dummy test key. Session cookies use `__Host-`/`__Secure-` prefixes (Secure enforced). No wildcard CORS on `/api/**` (the `access-control-allow-origin: *` seen earlier is only on the static document — a Vercel default, not a finding).
- **Transport** — CLEAN. HTTPS enforced, HSTS present (`max-age=63072000; includeSubDomains; preload`), HTTP→HTTPS 308 redirect.
- **Dev stub routes** — SAFE-BY-DEFAULT. `fake-outbox` / `fake-upload` return 404 unless `FAKE_VENDORS=1`; see operator-verification OV-1.

## Coverage & Scope

- Full per-route and per-area coverage: [coverage.md](./coverage.md). All 43 route handlers classified (SC-001); all six audit areas have an explicit outcome (SC-004).
- **Limitations / operator-verification items**:
  - **OV-1**: Confirm `FAKE_VENDORS` is not `"1"` in Vercel production env.
  - **OV-2**: Confirm `ASAAS_WEBHOOK_TOKEN` and `CRON_SECRET` are set to strong values (both fail closed if unset).
  - **OV-3**: Confirm `HttpOnly`/`SameSite` on the real post-login session cookie (NextAuth defaults apply; `Secure` already confirmed via cookie prefixes).
  - **OV-4**: SEC-004's ineffectiveness was established by code inspection, not live flooding (per the no-destructive-testing constraint).
  - Infrastructure not represented in the repo (Vercel WAF/edge config, DNS/TLS at the real domain, email-provider SPF/DKIM/DMARC) is outside a read-only code review — verify at the platform level before launch.

## Notes
- No destructive/intrusive testing was performed (FR-013): staging was probed only with `curl -sI` and a bounded number of benign requests; no flooding, no brute force, no data mutation.
- No application source was modified (FR-014); all remediation is advisory. Only files under `specs/015-security-audit/` were written; nothing was committed.
- **Action item outside the report**: rotate the owner-account password (`ivorium26@gmail.com`) shared during this session, and treat it as exposed.
