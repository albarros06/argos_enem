# Implementation Plan: Pre-Launch Security Audit

**Branch**: `015-security-audit` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-security-audit/spec.md`

## Summary

Perform a read-only, non-destructive security assessment of the Argos ENEM Next.js application before it is connected to a real production domain, and deliver a single **prioritized findings report** (`report.md`) plus a **coverage matrix** proving every route and audit area was reviewed. The audit is executed as a sequence of investigation tasks — static code review of the working tree, secret scanning of the tree and git history, dependency vulnerability checking, and non-destructive inspection of a deployed staging URL for runtime hardening — with **no new project dependency, no source-code fix, and no live exploitation**. Findings use a 4-tier severity scale (Critical/High/Medium/Low) with a separate launch-blocking flag. The technical approach favors tools already present (`pnpm audit`, `git`, `grep`) plus optional one-off `npx` scanners that install nothing into the project, per the constitution's simplicity and no-speculative-dependency principles.

## Technical Context

**Language/Version**: Audit target is TypeScript on Next.js 15 (App Router), React 19, Node (pnpm 11.5.3). The audit deliverable itself is Markdown; audit tooling is Bash + Node CLIs already available.

**Primary Dependencies**: No new dependencies added. Tooling used:
- `pnpm audit` (present) — dependency CVEs.
- `git`, `grep`/`ripgrep`, `find` (present) — route inventory, secret scanning, history scan.
- `curl` (present) — non-destructive HTTP header/cookie/TLS inspection against the staging URL.
- `vercel` CLI (present, v56.4.1; project is linked via `.vercel/`) — inspect deployment settings, env-var scoping, preview/staging deployment URLs, and project configuration relevant to hardening.
- **Optional, install-nothing** one-off scanners run via `npx` only if the operator wants deeper coverage (e.g., `npx gitleaks`-equivalent, OSV lookups). These are NOT added to `package.json`. No scanner (semgrep, gitleaks, trufflehog, osv-scanner) is currently installed, so the plan does not assume any.

**Storage**: N/A. The deliverable is `specs/015-security-audit/report.md` plus a `coverage.md` matrix in the same directory. Nothing written to application storage or the database.

**Testing**: Not a code feature; "test" means verification. Each launch-blocking finding must be independently re-checkable (SC-006): the report cites exact `file:line` (or the exact request/response for runtime findings) so a reviewer can confirm the defect and, later, confirm the fix.

**Target Platform**: The app is deployed on **Vercel** (confirmed by the operator; project is linked via `.vercel/`, `vercel.json` defines a Vercel Cron for `/api/cron/sweep`, matching the `Bearer CRON_SECRET` comment in the cron handler). **Note the contradiction**: `src/lib/auth.ts` carries a comment "Servidor Linux próprio atrás de proxy reverso (não Vercel)" alongside `trustHost: true`. This stale/incorrect comment is itself an audit lead — on Vercel, `trustHost` and canonical-host handling behave differently than the comment assumes, so host-header trust must be verified (US-2 boundary). On Vercel, security response headers and HTTPS come from Vercel defaults + `next.config.ts` `headers()` + `vercel.json` `headers` — and **neither file defines any `headers` block**, so missing security headers is a statically-confirmable finding (Vercel adds none by default), corroborated against the deployed staging/preview URL.

**Project Type**: Web application (Next.js App Router; API under `src/app/api/**/route.ts`, 43 route handlers; domain logic under `src/modules/**`; shared helpers under `src/lib/**`).

**Performance Goals**: N/A (audit is not latency-sensitive).

**Constraints**: Read-only — MUST NOT modify application source to fix defects (FR-014); MUST NOT run destructive/intrusive/DoS tests (FR-013); staging inspection MUST be non-destructive (no data mutation, no auth brute-forcing). Only artifacts under `specs/015-security-audit/` are written. No `git commit` is performed by the audit itself.

**Scale/Scope**: 43 API route handlers + auth/session layer + billing/credit module + groups module + submission/OCR pipeline + admin panel; 6 audit areas (authorization, payment/credit integrity, secrets, dependencies, runtime hardening, data exposure).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature produces **documentation only** (a report + coverage matrix); it adds no application code and no dependency. Evaluated against the five principles:

- **I. Código Legível Primeiro**: The deliverable's "readability" analogue is an actionable report — every finding is a self-contained, plainly-worded unit (risk → impact → remediation) a non-author can act on. **Pass.**
- **II. Estrutura Simples (YAGNI)**: No new dependency, no scanner installed into the project; reuses `pnpm audit` + `git`/`grep` + `curl`. Optional deeper scans run via `npx` (install-nothing) only on request. **Pass** — this is the simplest approach that meets the requirement.
- **III. Modularidade**: N/A for code, but the audit is organized into cohesive, independently-runnable areas (one investigation task per area) with an explicit coverage matrix — mirrors modular boundaries. **Pass.**
- **IV. Manutenibilidade**: The report is the maintainability artifact; findings cite exact locations so remediation and re-verification are cheap. **Pass.**
- **V. Preparado para Escala**: N/A (no runtime code). **Pass.**

**Result**: No violations. Complexity Tracking table left empty.

## Project Structure

### Documentation (this feature)

```text
specs/015-security-audit/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0: audit method & tooling decisions
├── data-model.md        # Phase 1: Finding / AuditedArea / Report entities + severity/blocker rubric
├── quickstart.md        # Phase 1: how to run the audit end-to-end
├── contracts/
│   ├── report-format.md     # Required structure of report.md (the deliverable "interface")
│   └── coverage-matrix.md   # Required structure of coverage.md (per-route, per-area coverage)
├── checklists/
│   └── requirements.md      # Spec quality checklist (already created)
├── report.md            # DELIVERABLE — produced when the audit runs (/speckit-implement)
└── coverage.md          # DELIVERABLE — produced when the audit runs (/speckit-implement)
```

`report.md` and `coverage.md` are **outputs of executing the audit** (the `/speckit-tasks` → `/speckit-implement` phase), not of planning. This plan defines their required shape via the contracts.

### Source Code (repository root) — audit scope, read-only

```text
src/
├── app/
│   └── api/**/route.ts          # 43 route handlers — full inventory & per-route authz classification (US-2)
├── lib/
│   ├── auth.ts                  # requireUser / requireVerifiedUser / requireAdmin — session+role gates
│   ├── config.ts                # env() — secret surface
│   ├── api.ts                   # handleRoute / ApiError — error-handling boundary
│   └── prisma.ts                # data-access layer
├── modules/
│   ├── auth/                    # credential verification
│   ├── billing/                 # Asaas webhook + subscription/credit state (US-3)
│   ├── groups/                  # group membership & object ownership (US-2 IDOR)
│   └── **                       # submissions, OCR, weekly-themes, etc.
next.config.ts                   # security headers / response config (US-6)
prisma/schema.prisma             # roles, ownership relations (US-2/US-3 authz model)
package.json / pnpm-lock.yaml    # dependency CVE surface (US-5)
```

**Structure Decision**: No source directories are created or modified. The audit reads the existing tree; the only files written are `report.md`, `coverage.md`, and the Phase 0/1 design docs under `specs/015-security-audit/`. Investigation is organized by the six spec audit areas, each mapping to one or more route/module groups above.

## Complexity Tracking

> No constitution violations — table intentionally empty.
