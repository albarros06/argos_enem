# Audit Coverage Matrix

**Audited commit**: `163efe598f09e7478d61c21e67a97e1a391c8225` · **Staging**: `https://argos-enem.vercel.app` · **Date**: 2026-07-23

## Area coverage

| Area | Coverage | Outcome | Findings |
|------|----------|---------|----------|
| authorization | covered | no-issue-found (per-route + IDOR verified) | — |
| payment-credit | covered | no-issue-found | — |
| secrets | covered | no-issue-found | — |
| dependencies | covered | findings | SEC-002, SEC-003, SEC-006, SEC-009 |
| runtime-hardening | covered | findings | SEC-001, SEC-004, SEC-005, SEC-007 |
| data-exposure | covered | no-issue-found (essay/PII endpoints owner-scoped) | — |
| *(cross-cutting)* platform-config | covered | findings | SEC-008 + operator-verification items below |

## Route authorization matrix (43 handlers)

**Gate catalog** (`src/lib/auth.ts`): `requireUser` (401 if no valid session), `requireVerifiedUser` (requireUser + verified email), `requireAdmin` (requireUser + `user.role === "admin"`, `auth.ts:69-71`). Object ownership is enforced in the **module layer**, not the route — verified per row below.

| Route | Methods | Classification | Object-scoped | Evidence |
|-------|---------|----------------|---------------|----------|
| /api/auth/[...nextauth] | (GET/POST via handler) | public-by-design | n/a | NextAuth handler; login `authorize` — **no rate limit** → SEC-001 |
| /api/auth/register | POST | public-by-design | n/a | `assertRateLimit(register:ip,10,60s)` register/route.ts:9 |
| /api/auth/forgot-password | POST | public-by-design | n/a | `assertRateLimit(forgot-password:email,3,60s)` :12 |
| /api/auth/reset-password | POST | public-by-design | n/a | token-based reset |
| /api/auth/verify-email | POST | public-by-design | n/a | token-based |
| /api/auth/resend-verification | POST | public-by-design | n/a | `assertRateLimit(...,1,60s)` :11 |
| /api/billing/plans | GET | public-by-design | n/a | public pricing list |
| /api/weekly-themes/active | GET | public-by-design | n/a | public active theme |
| /api/account | DELETE | session | self | requireUser |
| /api/credits | GET | session | self | requireUser |
| /api/dashboard | GET | session | self | requireUser |
| /api/billing/subscription | GET | session | self | requireUser |
| /api/billing/cancel | POST | session | self | requireUser |
| /api/billing/reactivate | POST | session | self | requireUser |
| /api/billing/upgrade | POST | session | self | requireUser |
| /api/billing/subscribe | POST | verified-session | self | requireVerifiedUser |
| /api/submissions | GET, POST | verified-session (POST) / session (GET) | self | requireVerifiedUser / requireUser; queries scoped by userId |
| /api/submissions/[id] | GET, DELETE | session | **yes** | `getSubmissionView(user.id,id)` checks `userId!==` → 404; `abandonSubmission`→`ownedSubmission` |
| /api/submissions/[id]/confirm | POST | session | yes | requireUser + ownedSubmission |
| /api/submissions/[id]/uploaded | POST | session | yes | requireUser + ownedSubmission |
| /api/groups | GET, POST | session | self | requireUser |
| /api/groups/join | POST | session | self | requireUser |
| /api/groups/[id] | GET, DELETE | session | **yes** | requireUser; DELETE→`deleteGroup`→`requireGroupLeader` |
| /api/groups/[id]/invite | POST | session | yes | requireUser + leader check |
| /api/groups/[id]/members/[userId] | DELETE | session | **yes** | `removeMember`→`requireGroupLeader` (group.ts:117) |
| /api/groups/[id]/themes | POST | session | yes | requireUser + leader check |
| /api/groups/[id]/themes/[themeId] | PATCH | session | yes | requireUser + leader/membership check |
| /api/groups/[id]/themes/[themeId]/contents | POST | session | yes | requireUser + leader check |
| /api/groups/[id]/themes/[themeId]/contents/[contentId] | DELETE | session | yes | requireUser + leader check |
| /api/groups/[id]/themes/[themeId]/content-upload-url | POST | session | yes | requireUser + leader check |
| /api/weekly-themes/active/my-entry | GET | session | self | requireUser |
| /api/weekly-themes/history | GET | session | self | requireUser |
| /api/admin/metrics | GET | admin | n/a | requireAdmin |
| /api/admin/weekly-themes | GET, POST | admin | n/a | requireAdmin |
| /api/admin/weekly-themes/[id] | GET, PATCH | admin | n/a | requireAdmin |
| /api/admin/weekly-themes/[id]/metrics | GET | admin | n/a | requireAdmin |
| /api/admin/weekly-themes/[id]/contents | POST | admin | n/a | requireAdmin |
| /api/admin/weekly-themes/[id]/contents/[contentId] | DELETE | admin | n/a | requireAdmin |
| /api/admin/weekly-themes/[id]/content-upload-url | POST | admin | n/a | requireAdmin |
| /api/webhooks/asaas | POST | secret-token | n/a | `asaas-access-token` == `ASAAS_WEBHOOK_TOKEN`, fail-closed if unset (route.ts:11); idempotent |
| /api/cron/sweep | GET, POST | secret-token | n/a | `Bearer CRON_SECRET`, fail-closed if unset (route.ts:24) |
| /api/fake-outbox | GET | dev-stub (gated) | n/a | 404 unless `FAKE_VENDORS=1` (`fakeVendorsEnabled()`) → operator-verify |
| /api/fake-upload/[...key] | GET, PUT | dev-stub (gated) | n/a | 404 unless `FAKE_VENDORS=1` → operator-verify |

**Result (SC-001)**: All 43 handlers accounted for. No `UNGUARDED` route. No IDOR/BOLA: every object-scoped route enforces ownership/leadership in the module layer.

## Notes / limitations (operator-verification items)

- **OV-1**: Confirm `FAKE_VENDORS` is **unset** (≠ `"1"`) in the Vercel production environment — the two `fake-*` stubs are code-reachable but return 404 unless this flag is on. (Fail-safe by default.)
- **OV-2**: Confirm `ASAAS_WEBHOOK_TOKEN` and `CRON_SECRET` are set to strong values in Vercel prod. Both handlers fail-closed (reject all) when unset, so a missing value breaks the feature rather than opening it — but a weak/guessable value would matter.
- **OV-3**: Session-cookie `HttpOnly`/`SameSite` were not fully observable pre-login; NextAuth defaults (`httpOnly`, `sameSite=lax`) apply and `__Host-`/`__Secure-` prefixes confirm `Secure`. Confirm on a real post-login session cookie.
- **OV-4**: Rate-limit effectiveness (SEC-004) could not be safely load-tested (no flooding per FR-013); the ineffectiveness is established by code inspection (in-memory `globalThis` store on distributed serverless), not by live abuse.
