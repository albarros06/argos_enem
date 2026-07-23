# Phase 0 Research: Pre-Launch Security Audit

No `NEEDS CLARIFICATION` markers remained after `/speckit-clarify` (severity model and runtime-verification method were resolved). This document records the **method and tooling decisions** for executing a read-only, non-destructive audit under the constitution's no-speculative-dependency rule.

## Decision 1 — Route inventory & authorization classification method

**Decision**: Enumerate all 43 handlers via `find src/app/api -name route.ts`, and for each exported HTTP method, trace the first statement(s) to one of the known gates in `src/lib/auth.ts` (`requireUser`, `requireVerifiedUser`, `requireAdmin`) or a webhook/cron secret check. Classify each route as: `public-by-design`, `session`, `verified-session`, `admin`, `secret-token`, or `UNGUARDED` (finding). For object-scoped routes (`[id]`, `[userId]`, `[themeId]`), additionally confirm the handler filters the query by the caller's ownership, not just by object id (IDOR/BOLA check).

**Rationale**: There is **no `middleware.ts`**, so authorization is per-route and must be verified per-route — a global grep for a guard is insufficient because a route can import a guard yet fail to scope the object query. Tracing each handler is the only reliable method and is fully static (read-only).

**Alternatives considered**: (a) Assume routes under `/api/admin` are admin-guarded by convention — rejected: convention is exactly what an audit must verify, not assume. (b) Runtime probing each route unauthenticated — rejected: risks state changes and is intrusive (violates FR-013); static tracing is safer and more complete.

## Decision 2 — Secret scanning approach (no new dependency)

**Decision**: Scan with `git grep`/`grep -r` over the working tree for high-signal patterns (API-key prefixes, `PRIVATE KEY`, provider token shapes for Google/AWS/Anthropic/Asaas/Resend), and scan git **history** with `git log -p -S<pattern>` / `git rev-list --all | git grep`. Separately, confirm no server-only value is read into a client component or `NEXT_PUBLIC_*` variable by grepping the client surface. Optionally, on request, run `npx gitleaks detect` (install-nothing) for a broader ruleset.

**Rationale**: `git` + `grep` are already present and cover the concrete secret shapes this project uses (env keys in `src/lib/config.ts`). Adding a scanner as a project dependency would violate Principle II (YAGNI / justified dependency) for a one-time audit.

**Alternatives considered**: Add `gitleaks`/`trufflehog` to `devDependencies` — rejected: speculative dependency for a one-off task; `npx` gives the same coverage without polluting `package.json`.

## Decision 3 — Dependency CVE checking

**Decision**: Run `pnpm audit --json` against the committed `pnpm-lock.yaml`; record each advisory with package, severity, vulnerable range, and fixed version. Separately flag security-critical **pre-release** pins by inspecting `package.json` — specifically `next-auth@5.0.0-beta.31` (auth is security-critical and this is a beta).

**Rationale**: `pnpm audit` is built into the package manager already in use; no install needed. Pre-release status is not a CVE but is a risk worth surfacing per US-5 AC-2.

**Alternatives considered**: `osv-scanner` — not installed; `pnpm audit` is sufficient and native. Can be cross-checked with `npx osv-scanner` on request.

## Decision 4 — Runtime hardening verification against staging

**Decision**: The app is on **Vercel** (linked `.vercel/`, `vercel.json` Cron). Inspect the operator-provided deployed **staging/preview URL** non-destructively with `curl -sI` (and a benign authenticated request if credentials are provided) to observe: security response headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy), session-cookie flags (`Secure`, `HttpOnly`, `SameSite`), HTTPS enforcement / HTTP→HTTPS redirect, and rate-limiting behavior on abuse-prone endpoints (observed via response codes/headers, **without** high-volume flooding — a small, bounded number of requests only). Cross-check with the `vercel` CLI for deployment/env configuration and to obtain the preview URL. On Vercel, security headers must come from `next.config.ts` `headers()` or `vercel.json` `headers`; **both currently define none**, so "no security headers" is confirmable statically (Vercel adds none by default) and then corroborated on staging. HTTPS/HSTS-at-edge and any control not confirmable in code is verified against staging; anything still unconfirmable (or if no staging URL is supplied) is recorded as an **operator-verification item** (FR-015).

**Rationale**: The clarify session chose staging-URL verification as the production-representative method. On Vercel, unlike a self-managed proxy, header/TLS behavior is well-defined: absence of a `headers` block in both config files means no custom security headers ship. Observing real responses on the preview deployment confirms this and catches anything set at the Vercel edge. Header inspection is inherently non-destructive.

**Alternatives considered**: (a) Boot a local dev instance — rejected in clarify: dev config diverges from the Vercel edge. (b) Infer purely from `next.config.ts` — insufficient alone, but on Vercel the combination of `next.config.ts` + `vercel.json` + a staging `curl` is decisive.

## Decision 5 — Payment/credit integrity review method

**Decision**: Static review of `src/app/api/webhooks/asaas/route.ts` and `src/modules/billing/**` to confirm: (a) the `asaas-access-token` shared-secret check is present and gates **all** state changes (already observed present — confirm it cannot be bypassed and rejects empty/misconfigured tokens), (b) webhook processing is idempotent against duplicate deliveries, and (c) credit-spend paths use an atomic/transactional decrement (DB transaction or conditional update) rather than read-then-write, to prevent double-spend under concurrency. Trace the submission→credit-debit path for check-then-act races.

**Rationale**: These are logic defects invisible to scanners and to header inspection; only reading the money paths finds them. Concurrency (double-spend) is the highest-value target and must be traced to the actual DB operation.

**Alternatives considered**: Load/concurrency test the live credit endpoint — rejected: intrusive and could corrupt billing state (violates FR-013). Static trace of the transaction boundary is decisive and safe.

## Decision 6 — Severity & launch-blocking rubric

**Decision**: 4-tier severity by (likelihood × impact) in a public-launch context; **launch-blocking** is a separate boolean. Rubric codified in `data-model.md`. Broadly: unauthenticated access to another user's data or funds, forgeable payments, or exposed live secrets → Critical + launch-blocking. Missing hardening headers or a medium-severity CVE with a fix → typically High/Medium, launch-blocking only if it materially raises exploitability of the public surface.

**Rationale**: Matches the clarify decision (4-tier + blocker flag) and keeps the go/no-go summary (FR-003) crisp and independent of the numeric tier.

**Alternatives considered**: CVSS — rejected in clarify (false rigor for a static self-audit). Binary blocker-only — rejected (loses backlog prioritization).

## Known lead already observed (to confirm during execution, not yet a finding)

- `src/app/api/fake-outbox/route.ts` and `src/app/api/fake-upload/[...key]/route.ts` showed **no** `NODE_ENV`/`production` guard on first grep — candidate for US-6 "dev stub reachable in production." Must be confirmed by reading the full handlers before asserting.
- **Neither `next.config.ts` nor `vercel.json` defines a `headers` block** — on Vercel this means no security headers ship by default. Strong US-6 candidate; confirm against the staging preview URL (Decision 4).
- `src/lib/auth.ts` comment claims the app is **not** on Vercel ("Servidor Linux próprio... não Vercel") while it is in fact Vercel-hosted, with `trustHost: true`. Stale/incorrect security-relevant comment → verify host-header/canonical-host trust is safe on Vercel (US-2). At minimum a documentation-integrity finding; assess whether `trustHost: true` is exploitable for host-header injection on this platform.
- Asaas webhook token check **is** present (good) — verify consistency and idempotency rather than assuming a gap.

### Staging baseline observed (2026-07-23, `https://argos-enem.vercel.app`, non-destructive `curl -sI`)

Staging URL for US-6 runtime checks: **`https://argos-enem.vercel.app`** (Vercel, live, `x-vercel-cache` present).

Present (good): HTTPS with **HSTS** (`strict-transport-security: max-age=63072000; includeSubDomains; preload`); **HTTP→HTTPS 308** permanent redirect.

**Missing on the document response (confirms the static header finding — formalize during execution):**
- No `Content-Security-Policy`
- No `X-Content-Type-Options: nosniff`
- No `X-Frame-Options` / `frame-ancestors` (clickjacking)
- No `Referrer-Policy`
- No `Permissions-Policy`

New lead: `access-control-allow-origin: *` was returned on the HTML document — **check whether API routes under `/api/**` also emit a wildcard CORS header**; a wildcard on authenticated JSON endpoints would be a real finding. (Homepage-only wildcard is low risk; verify the API surface during execution.)
