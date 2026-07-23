# Security Remediation — feature 016

**Branch**: `016-security-fixes` · **Date**: 2026-07-23 · **Fixes**: findings from [`../015-security-audit/report.md`](../015-security-audit/report.md)

Resolves the 015 pre-launch audit findings. Nothing committed yet — changes are in the working tree for review.

## Mutual-exclusivity analysis (as requested)

No two fixes are mutually exclusive. Two **sequencing** relationships, both handled:
- `next` ↑ and `next-auth` ↑ are done in one install pass (next-auth v5 peer accepts `next ^15||^16`).
- The login throttle (SEC-001) is built on the shared-store limiter (SEC-004), so the store landed first.

One fix has an **upstream version conflict** and is intentionally deferred (see SEC-006): the patched `sharp ≥0.35.0` is excluded by `next@15.5.21`'s pin of `sharp@^0.34.3`. Forcing it would break Next's image optimizer — a genuine mutual exclusion — so it stays a documented residual.

## Vercel environment analysis (as requested)

Queried via the linked `vercel` CLI (`vercel env ls`). Resolved the audit's open operator-verification items:
- **`FAKE_VENDORS` is NOT set** (Production or Preview) → `fake-*` dev stubs correctly 404 in prod. ✅
- **`CRON_SECRET` + `ASAAS_WEBHOOK_TOKEN` are set** (both environments); both handlers fail closed. ✅
- `AUTH_SECRET`, `APP_URL` set → `trustHost` is bounded (canonical host is `APP_URL`).
- Storage is **Cloudflare R2** (`R2_*`), not AWS S3 (correction to the audit's assumption).
- Values are encrypted at rest in Vercel; strength of `CRON_SECRET`/`ASAAS_WEBHOOK_TOKEN` not inspected (not pulled).

## What changed, per finding

| Finding | Fix | Files |
|---|---|---|
| **SEC-002** next-auth beta criticals | `next-auth` `beta.31 → beta.32` (pulls `@auth/core@0.41.3`, clears 3 critical + highs). Credentials-only, so OAuth advisories N/A | `package.json` |
| **SEC-003** next SSRF/disclosure | `next` `^15.5.19 → ^15.5.21` | `package.json` |
| **SEC-005** no security headers | `headers()` block: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, CSP `frame-ancestors 'none'; base-uri 'self'; object-src 'none'` (no `default-src`/`script-src` — would break Next hydration) | `next.config.ts` |
| **SEC-004** in-memory limiter | Replaced `globalThis` Map with a Postgres-backed sliding window shared across serverless instances; opportunistic + cron cleanup | `src/lib/rateLimit.ts`, `prisma/schema.prisma`, new migration, `src/app/api/cron/sweep/route.ts` |
| **SEC-001** login unthrottled | `assertRateLimit('login:'+email, 5, 5min)` in the Credentials `authorize` path | `src/lib/auth.ts` |
| **SEC-007** weak password policy | `passwordSchema`: min 10 + reject all-digits / single-repeated-char (blocks `senha123`); shared by register + reset. Not enforced on login → existing users unaffected | `src/modules/auth/index.ts` |
| **SEC-008** stale `não Vercel` comment / `trustHost` | Comment corrected; verified reset/verify links use `APP_URL` (`src/lib/email.ts:32,45`), not request host → no host-injection link poisoning | `src/lib/auth.ts` |
| **SEC-009** dev/transitive CVEs | `pnpm` overrides: `postcss ≥8.5.12`, `protobufjs ≥7.6.5` | `pnpm-workspace.yaml` |
| 3 async call sites | `await assertRateLimit(...)` (limiter is now async) | register / forgot-password / resend-verification routes |

## Dependency audit: 25 → 6

`pnpm audit`: **3 critical + 11 high + 10 moderate + 1 low (25)** → **0 critical + 5 high + 0 moderate + 1 low (6)**. All criticals and the runtime SSRF/auth/disclosure highs cleared.

**Accepted residuals (6)** — none in the production request path:
- `sharp` (high) — patched `≥0.35.0` excluded by `next@15.5.21`'s `^0.34.3` pin; needs a malicious image through Next's optimizer. Revisit when Next bumps sharp.
- `brace-expansion` ×3, `js-yaml` (high), `esbuild` (low) — ESLint/tsx/vitest build-and-dev tooling DoS; patched across incompatible majors, overriding risks breaking the toolchain for no runtime gain.

## Verification performed

- `tsc --noEmit` — clean.
- `eslint` (changed files) — clean.
- **Full test suite against a local dockerized Postgres — 196/196** (one transient failure was a self-inflicted duplicate-`DIRECT_URL` env var during the run, re-confirmed passing). The new migration `20260723120000_add_rate_limit_hit` applied via `prisma migrate deploy`; auth integration tests (register/login/reset) pass under the new async limiter and password policy.

## Deploy notes

- The build script already runs `prisma migrate deploy` → the `RateLimitHit` migration auto-applies on the next Vercel deploy. No manual DB step.
- **Post-deploy checks**: `curl -sI https://<domain>/` shows the 5 new headers; repeated failed logins for one email begin returning a blocked/`429`-style response.
- **Still recommended (not code)**: rotate the owner-account password shared during the audit; consider a stronger password strategy (breached-password check) later.
