# Contract: Scoring Call (Call 1)

Internal contract between `GradingProvider.scoreEssay()` and the model. Not an HTTP API.

## Request

- **Model**: `gemini-2.5-flash` (config: `business.gradingModelId`).
- **Runtime config** (all mandatory — the tuned QWK depends on them):
  - `thinking_budget = -1` (dynamic thinking ON)
  - `maxOutputTokens = 32768`
  - `temperature = 0`
  - **No** `responseMimeType`/`responseJsonSchema` — free-form text output.
- **Prompt & message construction** — MUST replicate the validated harness `render()`
  (`enem_db/fine_tuning/src/enem_grader/grader.py:43-54`) exactly, or the QWK will not
  reproduce (SC-001):
  - **system_instruction** = the full `v5_calibrated.md` text with the two placeholder
    tokens `{{THEME}}` and `{{ESSAY}}` **removed** (`.replace(...,"")`) and trimmed — NOT
    truncated before them, NOT substituted into.
  - **user content** = exactly `"THEME (motivating text):\n{theme}\n\nESSAY:\n{essayText}\n"`
    (English labels, this precise layout). Do NOT reuse the Portuguese
    `buildGradingUserMessage` here.
- **Inputs**: `theme` (submission theme text), `essayText` (`transcription.confirmedText`).

## Response (model output)

Free-form reasoning, then a trailing block. Only the block is consumed:

```
ANNULLED: <yes|no>
C1: <0|40|80|120|160|200>
C2: <0|40|80|120|160|200>
C3: <0|40|80|120|160|200>
C4: <0|40|80|120|160|200>
C5: <0|40|80|120|160|200>
```

## Parser rules (`scoreParser.ts`)

1. Match each label case-insensitively; take the **last** occurrence of each line (the block
   is the tail, after any reasoning that may echo the labels).
2. `ANNULLED` must be `yes` or `no` → `annulled: boolean`.
3. Each `C1..C5` must parse to an integer in `{0,40,80,120,160,200}`.
4. If `annulled === true`, force all five scores to `0` regardless of parsed values.
5. **Failure** (any label missing, unparseable, out-of-set value, or empty response /
   `finishReason` indicating truncation) → throw. The caller routes this to the existing
   fail-and-refund path. Never emit a defaulted/guessed score.

## Output type

```ts
interface ScoringResult {
  annulled: boolean;
  scores: Record<1 | 2 | 3 | 4 | 5, 0 | 40 | 80 | 120 | 160 | 200>;
}
```

## Test vectors (for unit coverage)

- Well-formed non-annulled block → five scores parsed, `annulled=false`.
- `ANNULLED: yes` with non-zero `C*` lines → all scores forced to 0.
- Labels also present inside reasoning prose → last occurrence wins.
- Missing `C4` line → throw.
- `C2: 100` (not in allowed set) → throw.
- Empty response / truncated (no block) → throw.
