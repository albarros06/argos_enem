# Contract: `coverage.md` structure

`specs/015-security-audit/coverage.md` proves the audit's breadth: every audited area has an explicit outcome (FR-012) and every non-public route is accounted for (SC-001).

```markdown
# Audit Coverage Matrix

## Area coverage

| Area | Coverage | Outcome | Findings |
|------|----------|---------|----------|
| authorization | covered | findings | SEC-001, SEC-004 |
| payment-credit | covered | no-issue-found | — |
| secrets | covered | no-issue-found | — |
| dependencies | covered | findings | SEC-006 |
| runtime-hardening | covered | findings | SEC-002 |
| data-exposure | covered | operator-verification-required | see notes |

<Every one of the six areas MUST appear. "no-issue-found" is stated explicitly, never by omission.>

## Route authorization matrix

<One row per exported HTTP method across all 43 route handlers.>

| Route | Method | Classification | Object-scoped | Evidence |
|-------|--------|----------------|---------------|----------|
| /api/submissions/[id] | GET | verified-session | yes | route.ts:NN → requireVerifiedUser + ownerId filter |
| /api/admin/metrics | GET | admin | n/a | route.ts:NN → requireAdmin |
| /api/webhooks/asaas | POST | secret-token | n/a | route.ts:10 → asaas-access-token check |
| /api/cron/sweep | GET | secret-token | n/a | route.ts:24 → Bearer CRON_SECRET |
| … | … | … | … | … |

## Notes / limitations
<Operator-verification items, areas not verifiable read-only, staging caveats.>
```

## Contract rules
- **CR-1**: All six areas present with an explicit `Outcome`; `no-issue-found` is written, not implied (FR-012, SC-004).
- **CR-2**: Every one of the 43 route handlers appears in the route matrix at least once (per exported method) (SC-001).
- **CR-3**: Any row with `Classification = UNGUARDED`, or `Object-scoped = no` on a protected object route, has a matching `SEC-###` in the report.
- **CR-4**: `Evidence` cites the concrete `file:line` of the guard (or its absence).
