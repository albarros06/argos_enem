# Phase 0 Research: Migrate Gemini Grading Provider to Vertex AI

**Feature**: `004-vertex-ai-migration` | **Date**: 2026-07-16

This document resolves the technical unknowns behind the plan. Each item follows the
Decision / Rationale / Alternatives format.

## R1. How to switch `@google/genai` from API-key mode to Vertex AI mode

**Decision**: Construct the client as
`new GoogleGenAI({ vertexai: true, project, location, googleAuthOptions: { credentials } })`,
where `credentials` is the parsed `GOOGLE_APPLICATION_CREDENTIALS_JSON` object.

**Rationale**: Verified against the installed `@google/genai@2.11.0` type definitions
(`node_modules/@google/genai/dist/node/node.d.ts`, `GoogleGenAIOptions`): `vertexai`,
`project`, `location`, and `googleAuthOptions` are all first-class options on Node
runtimes. `googleAuthOptions.credentials` accepts the same service-account JSON object
already parsed for the Vision client in `src/modules/transcription/provider.ts:15`, so
auth is identical to the existing OCR path. The `models.generateContent` call, including
`systemInstruction`, `responseMimeType`, `responseJsonSchema`, `temperature`, and
`maxOutputTokens`, is unchanged between the two backends — only client construction differs.

**Alternatives considered**:
- `@google-cloud/vertexai` package — a second, overlapping SDK. Rejected (constitution II):
  `@google/genai` is already a dependency and already used by the grading provider.
- Application Default Credentials via `GOOGLE_APPLICATION_CREDENTIALS` file path — rejected;
  the deployment supplies the credential as an inline JSON env var, not a file, matching the
  existing OCR pattern.

## R2. Where the Google Cloud project comes from

**Decision**: Default the project to the `project_id` field inside the parsed
`GOOGLE_APPLICATION_CREDENTIALS_JSON`. Allow an explicit override via `GOOGLE_CLOUD_PROJECT`.

**Rationale**: The service-account JSON always contains `project_id` (already asserted in
`tests/unit/env-config.test.ts:70`). Deriving the project from the credential avoids adding a
required env var (constitution II — Estrutura Simples) and guarantees the project matches the
credential. An override is kept for the case where the credential is authorized on a different
project for Vertex than the one it was minted in.

**Alternatives considered**:
- Require `GOOGLE_CLOUD_PROJECT` unconditionally — rejected as redundant config the credential
  already carries.

## R3. Default region

**Decision**: Default `GOOGLE_CLOUD_LOCATION` to `us-central1`, overridable via env var.

**Rationale**: São Paulo (`southamerica-east1`) was the first choice for data residency of
Brazilian student PII (original FR-011), but a live probe confirmed `gemini-2.5-pro` returns
HTTP 404 there — it is not served in São Paulo (R4). The team accepted `us-central1`, where the
model is available, trading in-region residency for grading quality. Essays are processed
transiently in the US (Vertex AI does not store or train on the data under standard terms); the
cross-border transfer is covered by an LGPD legal basis and disclosed in the privacy policy.
Latency is immaterial because grading runs as an async background task. Region stays a config
value so it can move without a code change.

**Alternatives considered**: `southamerica-east1` — rejected, does not serve `gemini-2.5-pro`.
A lighter in-region model (`gemini-2.5-flash`) — rejected to preserve grading fidelity for
nuanced Portuguese essay evaluation. `global` endpoint — viable but offers no residency guarantee
and was not needed once `us-central1` was chosen.

## R4. Model availability by region

**Finding (verified via live probe)**: `gemini-2.5-pro` returns HTTP 404 in `southamerica-east1`
(not served) and responds successfully in `us-central1`. This directly drove the region decision
in R3/FR-011.

**Decision**: Treat model-region availability as an operational precondition, not a code
concern. If the selected model (`business.gradingModelId`, default `gemini-2.5-pro`) is not
served in the configured region, the Vertex call fails; the provider surfaces a clear error
naming the model and region (FR-012). Resolution is operational: pick an available model or
override the region.

**Rationale**: The set of models offered per region changes over time and is Google-controlled;
encoding a static allowlist in code would be speculative and quickly stale (constitution II).
Failing loudly with an actionable message satisfies FR-008/FR-012 without added complexity.

**Alternatives considered**: A hardcoded model→region compatibility map — rejected as
speculative and maintenance-heavy.

## R5. Controlled JSON output parity on Vertex

**Decision**: Keep the existing `responseMimeType: "application/json"` +
`responseJsonSchema: GEMINI_EVALUATION_SCHEMA` + `temperature: 0` config as-is; keep the
`"none"` → `null` `zeroReason` remap and the final `llmEvaluationSchema.parse`.

**Rationale**: Controlled generation with a response schema and temperature 0 is supported on
the Vertex backend through the same `generateContent` config surface. Preserving the schema,
the sentinel remap, and the Zod validation guarantees the `LlmEvaluation` contract is byte-for-byte
compatible (FR-004) and grading stays reproducible (FR-005, SC-002). Validation happens on our
side regardless of backend, so any drift is caught rather than persisted.

**Alternatives considered**: Switching to `responseSchema` (SDK `Schema` type) — rejected; the
current `responseJsonSchema` already works and changing it risks altering output for no benefit.

## R6. Prompt caching behavior

**Decision**: Keep passing the frozen rubric as `systemInstruction`; rely on Vertex implicit
context caching. No explicit cached-content resource is created.

**Rationale**: The stable rubric prefix is what enables implicit caching on Gemini 2.5 models
(the R3 cost lever noted in code). This behavior carries over on Vertex without extra wiring;
explicit `CachedContent` would add lifecycle management for marginal benefit (constitution II).

**Alternatives considered**: Explicit Vertex context caching — deferred; not needed to meet any
requirement and adds a managed resource to maintain.

## R7. Next.js server bundling of the SDK

**Decision**: Add `@google/genai` to `serverExternalPackages` in `next.config.ts` alongside the
existing `@google-cloud/vision` entry.

**Rationale**: In Vertex mode the SDK pulls in `google-auth-library`, which relies on Node
built-ins and dynamic requires that Next's server bundler can mis-handle. The project already
externalizes `@google-cloud/vision` for the same reason (`next.config.ts`). Mirroring that entry
is the low-risk, consistent choice. (In API-key mode the SDK used only `fetch`, so it did not
previously need externalizing.)

**Alternatives considered**: Leaving it bundled — rejected as a bundling-risk with a known,
one-line mitigation already established in the repo.

## R8. IAM / permissions

**Decision**: The existing OCR service account must additionally be granted
`roles/aiplatform.user` on the target project, and the Vertex AI API
(`aiplatform.googleapis.com`) must be enabled with billing. This is an operational step captured
in quickstart, not a code change.

**Rationale**: Vertex AI invocation requires the `aiplatform.user` role; the Vision-only grant is
insufficient. Enabling the API and role is a one-time console/CLI action.

**Alternatives considered**: A separate dedicated service account for grading — rejected;
consolidating onto the existing account is the migration's stated goal (US1) and reduces secrets.

## R9. Removal of the `GEMINI_API_KEY` path

**Decision**: Remove `GEMINI_API_KEY` from the env schema (`src/lib/config.ts`), delete its use
in `GeminiGradingProvider`, and remove it from `.env.example`. Local dev / CI use the fake
provider (`FAKE_VENDORS=1`) or the Claude path.

**Rationale**: Spec clarification (FR-009) — a single Gemini auth path (Vertex) reduces surface
area and dead config (constitution II/IV). No test currently asserts `GEMINI_API_KEY`, so removal
is contained.

**Alternatives considered**: Keeping the key as a fallback — rejected per FR-009 (chosen: remove).

## Open items

None. All spec clarifications are resolved; no `NEEDS CLARIFICATION` remains in Technical Context.
