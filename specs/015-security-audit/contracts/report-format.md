# Contract: `report.md` structure

The deliverable `specs/015-security-audit/report.md` MUST follow this structure. This is the "interface" the reader (the launch decision-maker) consumes; the audit execution phase fills it in.

```markdown
# Pre-Launch Security Audit — Argos ENEM

**Date**: <YYYY-MM-DD>
**Scope**: <commit SHA audited> · staging URL inspected: <url or "none provided">
**Auditor**: <name/agent>
**Verdict**: <GO | GO-WITH-FIXES | NO-GO> — <one sentence>

## Launch-Blocking Summary

<Table of ONLY the findings with launch_blocking = yes, most severe first.>

| ID | Severity | Title | Area | Fix effort |
|----|----------|-------|------|-----------|
| SEC-001 | Critical | … | authorization | … |

<If none: state "No launch-blocking findings." explicitly.>

## All Findings (severity-ordered)

### SEC-001 — <title>
- **Severity**: <Critical/High/Medium/Low> · **Launch-blocking**: <yes/no> · **Confirmation**: <confirmed/potential>
- **Area**: <one of six>
- **Location**: `<file:line>` <or request/response for runtime findings>
- **Risk**: <what is wrong>
- **Impact**: <what an attacker gains at public launch>
- **Remediation**: <specific, actionable fix>
- **Affected items** (if grouped): <list>
- **Verification** (if potential): <non-destructive step to confirm>

### SEC-002 — …
…

## Coverage & Scope

- Areas covered and outcome: see [coverage.md](./coverage.md).
- **Limitations / operator-verification items**: <what read-only review or the staging environment could not confirm — e.g., production-only env values, edge/WAF config, controls with no staging URL>.

## Notes
- No destructive/intrusive testing was performed (FR-013).
- No application source was modified to remediate (FR-014); fixes are recommendations only.
```

## Contract rules
- **CR-1**: Findings ordered by severity (Critical→Low), then launch-blocking `yes` before `no` within a tier.
- **CR-2**: The Launch-Blocking Summary lists exactly the findings with `launch_blocking = yes` — and explicitly says "none" if empty (FR-003).
- **CR-3**: Every finding block has all fields from the Finding entity; `Remediation` is never empty or "TODO" (SC-002).
- **CR-4**: `potential` findings carry a non-destructive `Verification` step (FR-013).
- **CR-5**: The Limitations subsection is present even if empty ("None") so scope gaps are never silently dropped (FR-015).
- **CR-6**: The `Verdict` reflects the launch-blocking set: any launch-blocking finding ⇒ not `GO`.
