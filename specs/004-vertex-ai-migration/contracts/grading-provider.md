# Contract: Grading Provider & Vertex AI Configuration

**Feature**: `004-vertex-ai-migration` | **Date**: 2026-07-16

This is an internal server-side contract (no HTTP surface). It defines what the grading module
guarantees before and after the migration, so the change can be verified against a fixed
interface.

## 1. Provider interface (unchanged)

```ts
interface GradingInput {
  theme: string;
  essayText: string;
}

interface GradingProvider {
  grade(input: GradingInput): Promise<LlmEvaluation>;
}
```

**Guarantee**: `GeminiGradingProvider` continues to implement `GradingProvider`. Callers
(`src/modules/grading/index.ts`) require no changes.

## 2. Client construction (changed)

**Before** — Gemini Developer API (API key):

```ts
new GoogleGenAI({ apiKey: env().GEMINI_API_KEY });
```

**After** — Vertex AI (service account):

```ts
new GoogleGenAI({
  vertexai: true,
  project: effectiveProject,          // GOOGLE_CLOUD_PROJECT || credential.project_id
  location: env().GOOGLE_CLOUD_LOCATION, // default "us-central1"
  googleAuthOptions: {
    credentials: JSON.parse(env().GOOGLE_APPLICATION_CREDENTIALS_JSON),
  },
});
```

**Guarantee**: The `generateContent` request body is unchanged — same `systemInstruction`
(frozen rubric), `responseMimeType: "application/json"`, `responseJsonSchema`
(`GEMINI_EVALUATION_SCHEMA`), `temperature: 0`, `maxOutputTokens: 8192`, and the same
`"none"`→`null` `zeroReason` remap followed by `llmEvaluationSchema.parse`.

## 3. Configuration contract

| Input | Rule |
|-------|------|
| Credentials | `GOOGLE_APPLICATION_CREDENTIALS_JSON` must parse to a `service_account` object with `project_id`, `private_key`, `client_email`. |
| Project | `GOOGLE_CLOUD_PROJECT` if set, else credential `project_id`. Empty both → configuration error. |
| Region | `GOOGLE_CLOUD_LOCATION`, default `us-central1`. |
| Model | `GRADING_MODEL_ID` with `gemini-` prefix routes here. |

## 4. Error contract

| Condition | Behavior |
|-----------|----------|
| Credentials missing/unparseable when a Gemini model is selected and `FAKE_VENDORS≠1` | Throw a clear error naming the missing/invalid `GOOGLE_APPLICATION_CREDENTIALS_JSON` (FR-008). |
| Effective project cannot be determined | Throw a clear configuration error (FR-008). |
| Selected model not available in region | Surface the Vertex error, identifying model and region (FR-012). |
| Empty/blocked model response | Throw `"Gemini retornou resposta vazia (finishReason: …)"` (unchanged). |
| Output not valid JSON / fails schema | Throw (unchanged) — malformed evaluation is never persisted (FR-004). |

No silent fallback to the removed API-key path (FR-009).

## 5. Test contract

| Test | Assertion |
|------|-----------|
| Provider selection | `gemini-*` model + `FAKE_VENDORS≠1` → `GeminiGradingProvider`; `claude-*` → Anthropic; `FAKE_VENDORS=1` → fake. |
| Vertex wiring | `GeminiGradingProvider` constructs `GoogleGenAI` with `vertexai: true`, the derived project, and `GOOGLE_CLOUD_LOCATION` (default `us-central1`). |
| Config defaults | `GOOGLE_CLOUD_LOCATION` defaults to `us-central1`; effective project falls back to credential `project_id`; `GEMINI_API_KEY` no longer part of the schema. |
| Offline | With `FAKE_VENDORS=1`, grading makes no external calls (existing behavior preserved). |
| Contract preserved | `LlmEvaluation` shape and value ranges unchanged (existing `grading-schema.test.ts`). |
