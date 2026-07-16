# Feature Specification: Migrate Gemini Grading Provider to Vertex AI

**Feature Branch**: `004-vertex-ai-migration`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "migrate Gemini grading provider to Vertex AI"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operator Runs Grading Through Vertex AI on the Existing Service Account (Priority: P1)

An operator deploying the platform wants essay grading powered by Gemini models to authenticate and bill through the organization's existing Google Cloud service account — the same identity already used for OCR — instead of a standalone Gemini Developer API key. This consolidates access control, billing, quota, and data-governance under one Google Cloud project.

**Why this priority**: This is the core purpose of the migration. Without it, grading depends on a separate credential and billing surface with weaker enterprise data guarantees. Delivering just this story achieves the migration's primary value.

**Independent Test**: With only the Google Cloud service-account credentials and a project/region configured (no Gemini Developer API key present), submit an essay for grading and confirm it is scored successfully and the request is authenticated through the service account.

**Acceptance Scenarios**:

1. **Given** the service-account credentials, project, and region are configured and no Gemini Developer API key is set, **When** an essay is submitted for grading with a Gemini model selected, **Then** the essay is graded successfully and the request authenticates via the service account.
2. **Given** grading is configured to use Vertex AI, **When** an operator inspects Google Cloud billing and audit logs, **Then** the grading requests appear under the configured Google Cloud project.
3. **Given** the platform is configured to use a Claude model instead, **When** an essay is graded, **Then** grading continues to use the Anthropic path unchanged and does not require Vertex AI configuration.

---

### User Story 2 - Student Sees No Change in Grading Quality or Behavior (Priority: P2)

A student submitting an essay must receive the same structured evaluation — five competency scores, general feedback, inline annotations, and zero-grade reasons — with the same quality and consistency as before the migration. The change of underlying provider must be invisible to end users.

**Why this priority**: The migration is an infrastructure change that must not regress the product. Protecting grading output integrity guards against a silent quality or contract regression, but it depends on Story 1 being in place first.

**Independent Test**: Grade a fixed benchmark set of essays before and after the migration and confirm the returned evaluation structure is identical and the scores are reproducible.

**Acceptance Scenarios**:

1. **Given** a graded essay, **When** the evaluation is returned via Vertex AI, **Then** it contains exactly the same fields and value ranges as the pre-migration evaluation (five competencies, per-competency scores, justifications, general feedback, annotations, and zero-grade reason).
2. **Given** the same essay and theme are graded twice, **When** grading runs through Vertex AI, **Then** the resulting scores are reproducible across runs.
3. **Given** a grading request fails or the model returns an unusable response, **When** the failure occurs, **Then** the system reports a clear error and does not persist a malformed evaluation.

---

### User Story 3 - Developer Runs the App and Tests Without Google Cloud Access (Priority: P3)

A developer working locally, and the automated test suite in CI, must be able to exercise grading flows without real Google Cloud credentials or external calls, so that development and testing remain fast, offline, and free of cloud dependencies.

**Why this priority**: Preserving local and CI developer experience prevents the migration from adding friction or cost to everyday development, but it is subordinate to delivering the migration itself.

**Independent Test**: With external vendors disabled, run the test suite and a local grading flow and confirm essays are graded by the deterministic fake with no network calls to Google Cloud.

**Acceptance Scenarios**:

1. **Given** external vendors are disabled, **When** grading runs, **Then** the deterministic fake evaluation is returned with no external calls.
2. **Given** a developer without Google Cloud access starts the app locally, **When** they follow the documented local setup, **Then** they can grade essays without configuring Vertex AI credentials.

---

### Edge Cases

- What happens when Vertex AI is selected but the service-account credentials are missing, malformed, or lack the required Vertex AI permission? The system must surface a clear, actionable configuration error rather than failing silently or with an opaque message.
- What happens when the configured Google Cloud project or region is missing or unset while a Gemini model is selected?
- What happens when the selected Gemini model is unavailable in the configured region? The system must surface a clear error naming the model and region (FR-012). (This was the case for `gemini-2.5-pro` in `southamerica-east1`, which drove the `us-central1` decision in FR-011.)
- What happens to in-flight or queued grading jobs during a deployment that switches the provider path?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST route grading requests that use a Gemini model through Vertex AI.
- **FR-002**: System MUST authenticate Vertex AI grading requests using the existing Google Cloud service-account credentials already used for OCR, without introducing a new secret format.
- **FR-003**: System MUST allow the Google Cloud project and region used for grading to be configured as environment/configuration values without code changes.
- **FR-004**: The structure and value ranges of a returned grading evaluation MUST remain identical to the pre-migration output (five competencies with scored justifications, general feedback, inline annotations, and an optional zero-grade reason).
- **FR-005**: Grading MUST remain reproducible: identical essay and theme inputs MUST yield consistent scores across runs.
- **FR-006**: The Anthropic/Claude grading path MUST remain fully functional and unaffected by this change, selectable by the same model-selection mechanism as today.
- **FR-007**: The deterministic fake grading provider used by tests and end-to-end flows MUST remain functional and MUST NOT make external calls.
- **FR-008**: When Vertex AI is selected but required configuration (credentials, project, or region) is missing or invalid, the system MUST fail with a clear, actionable error identifying the missing configuration.
- **FR-009**: The legacy Gemini Developer API-key grading path MUST be removed: Gemini-model grading MUST run exclusively via Vertex AI, and the Gemini Developer API key MUST no longer be used or required by the grading system.
- **FR-010**: Configuration documentation and example configuration MUST be updated to describe the settings required to run grading on Vertex AI (credentials, project, region) and to reflect the removal of the Gemini Developer API key.
- **FR-011**: Grading MUST default to the `us-central1` Google Cloud region, while still allowing the region to be overridden via configuration (FR-003). `southamerica-east1` (São Paulo) was originally chosen for data residency of Brazilian student data, but `gemini-2.5-pro` is not served there (verified: HTTP 404 in São Paulo). The team accepted `us-central1` — student essays are processed transiently in the US (Vertex AI does not store or train on the data under standard terms), a cross-border transfer that MUST be covered by an appropriate LGPD legal basis and disclosed in the privacy policy.
- **FR-012**: If the selected Gemini model is not available in the configured region, the system MUST fail with a clear, actionable error identifying the model and region, rather than silently degrading.

### Key Entities *(include if data involved)*

- **Grading Evaluation**: The structured result of grading one essay — five competency entries (each with a competency number, score, and justification), a general feedback message, a list of inline annotations, and an optional zero-grade reason. Its shape must be preserved across the migration.
- **Grading Configuration**: The set of values that determine how grading is performed and authenticated — selected model, provider credentials, Google Cloud project, and region. Lives outside source code.
- **Service-Account Credentials**: The existing Google Cloud identity (already used for OCR) that must be authorized to invoke Vertex AI for grading.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Gemini-model grading requests in the target deployment authenticate through the Google Cloud service account, with zero requests relying on a Gemini Developer API key.
- **SC-002**: For a fixed benchmark set of essays, post-migration evaluations match pre-migration evaluations in structure for 100% of essays, and produce identical scores under reproducible-grading settings.
- **SC-003**: End users experience no change in grading behavior — no new user-visible errors and no increase in grading turnaround time beyond normal variance after the migration.
- **SC-004**: An operator can configure a fresh environment to run grading on Vertex AI by following the updated documentation in under 15 minutes, without reading source code.
- **SC-005**: The full automated test suite passes with external vendors disabled and makes zero network calls to Google Cloud.

## Assumptions

- The Google Cloud service account already used for OCR can be granted the permission required to invoke Vertex AI within the same Google Cloud project; no separate identity is required.
- The organization has (or will enable) Vertex AI with billing on the target Google Cloud project.
- Model selection continues to use the existing model-identifier mechanism; a Gemini model identifier selects the Gemini/Vertex path and a Claude identifier selects the Anthropic path.
- The Gemini Developer API-key path is removed entirely (FR-009); local development and CI rely on the deterministic fake provider (`FAKE_VENDORS`) or the Claude/Anthropic path, so no developer needs a Gemini Developer API key.
- The Gemini model in production use (`gemini-2.5-pro`) is available in `us-central1` (verified). It is NOT available in `southamerica-east1`; if a required model is not offered in the configured region, that is surfaced as a configuration error (FR-012) and resolved operationally by choosing an available model or region.
- Cross-border processing of student essays in the US (`us-central1`) has an appropriate LGPD legal basis and is disclosed to users; this is an operational/legal precondition, not a system behavior.
- Data-governance expectations (e.g., customer data not used for model training) are met by Vertex AI's standard terms for the configured project.
- No change to the grading rubric, prompt, competency schema, or scoring scale is in scope; this feature changes only how the Gemini model is reached and authenticated.
