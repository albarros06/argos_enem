# Change: Grading LLM migrated to Google Gemini

**Date**: 2026-07-15 | **Branch**: `002-redacoes-semana`
**Supersedes**: R3 of [001 research.md](../001-enem-essay-grading/research.md) and the
Grading LLM row of [001 stack.md](../001-enem-essay-grading/stack.md).

## Summary

The grading LLM was switched from Claude Sonnet to **Google Gemini** (default
`gemini-2.5-pro`). The change is confined to the `grading` module's vendor adapter and to
configuration. The ENEM rubric, the output schema, annotation anchoring, the zero-score
rules, and the rest of the submission pipeline are unchanged. The provider now selects
itself from the model id, so the Anthropic adapter stays in place as a drop-in fallback.

## Decision

**Decision**: Use the official Google Gen AI SDK (`@google/genai`) via
`models.generateContent`, with structured output through `responseJsonSchema` and the ENEM
rubric sent as `systemInstruction` (Gemini implicit prompt caching). Default model
`gemini-2.5-pro`, overridable with `GRADING_MODEL_ID`.

**Rationale**:
- Keeps the vendor behind the existing `GradingProvider` interface (Constitution III) — no
  change to callers or to the grading pipeline.
- `responseJsonSchema` mirrors `llmEvaluationSchema`, so the server-side Zod re-validation
  contract is preserved (exactly 5 competencies, scores in {0,40,80,120,160,200}, anchored
  annotations, `zeroReason` rules).
- Provider auto-selection by model-id prefix keeps model choice as configuration, not code
  (Constitution I/IV), and keeps Anthropic as a one-env-var fallback for A/B on SC-003.

**Alternatives considered**:
- Replace the Anthropic adapter outright — rejected; loses the fallback and the ability to
  benchmark against Claude.
- Add a separate `GRADING_PROVIDER` env var — rejected; redundant with the model id and one
  more lever to keep in sync.

## Implementation

Files changed:
- `src/modules/grading/llm.ts` — new `GeminiGradingProvider` (structured output, rubric as
  system instruction, `temperature: 0`, and a `"none" -> null` sentinel remap for
  `zeroReason`). `gradingProvider()` now selects fake / Gemini / Anthropic.
- `src/lib/config.ts` — new `GEMINI_API_KEY`; `GRADING_MODEL_ID` default is now
  `gemini-2.5-pro`.
- `.env.example` — Gemini key and the provider-selection note.
- `package.json` / `pnpm-lock.yaml` — add `@google/genai@^2.11.0`.

Provider selection (`gradingProvider()`):

```ts
if (fakeVendorsEnabled())               // tests, FAKE_VENDORS=1
  -> FakeGradingProvider
else if (modelId.startsWith("gemini"))
  -> GeminiGradingProvider
else
  -> AnthropicGradingProvider
```

`zeroReason` mapping: `responseJsonSchema` is steered with a plain string enum, so the
schema uses a `"none"` sentinel; the provider remaps `"none" -> null` before Zod validation
to match `llmEvaluationSchema`.

## Configuration

| Var | Default | Notes |
|-----|---------|-------|
| `GRADING_MODEL_ID` | `gemini-2.5-pro` | `gemini-*` -> Gemini, `claude-*` -> Anthropic. Alternatives: `gemini-3.1-pro`, `gemini-2.5-flash`, `claude-sonnet-5`. |
| `GEMINI_API_KEY` | (empty) | Required when the model is `gemini-*` and `FAKE_VENDORS` is off. |

## Verification

- Strict `tsc` type-check of `llm.ts` + `config.ts` against the real SDK types: clean.
- Prettier: clean. `package.json`: valid JSON.
- Tests unaffected: `FAKE_VENDORS=1` (`tests/setup.ts`, `playwright.config.ts`)
  short-circuits to `FakeGradingProvider`, so no Gemini calls are made.

## Follow-ups

- Run `pnpm install` to materialize `@google/genai` in `node_modules`.
- The Gemini provider path has no automated coverage (the fake replaces it). Add a unit
  test that mocks the `GoogleGenAI` client, or run the SC-003 benchmark against the real API.
- Re-measure per-essay cost under `gemini-2.5-pro` and validate SC-003 (>=80% of totals
  within +/-100 pts; <=1 competency step off in 70%) before locking the model in.
