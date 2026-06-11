import { describe, expect, it } from "vitest";
import {
  llmEvaluationSchema,
  validateEvaluationConsistency,
  type LlmEvaluation,
} from "@/modules/grading/schema";

function validEvaluation(): LlmEvaluation {
  return {
    zeroReason: null,
    competencies: [1, 2, 3, 4, 5].map((competency) => ({
      competency: competency as 1 | 2 | 3 | 4 | 5,
      score: 120,
      justification: "Justificativa.",
    })),
    generalFeedback: "Comentário geral.",
    annotations: [{ competency: 1, excerpt: "trecho", issue: "problema", suggestion: "sugestão" }],
  };
}

describe("LLM evaluation schema", () => {
  it("accepts a complete valid evaluation", () => {
    const parsed = llmEvaluationSchema.parse(validEvaluation());
    expect(validateEvaluationConsistency(parsed)).toEqual(validEvaluation());
  });

  it("rejects scores outside the official 40-point steps", () => {
    const invalid = validEvaluation();
    invalid.competencies[0].score = 50 as never;
    expect(() => llmEvaluationSchema.parse(invalid)).toThrow();
  });

  it("rejects an evaluation with a missing competency", () => {
    const invalid = validEvaluation();
    invalid.competencies = invalid.competencies.slice(0, 4);
    expect(() => validateEvaluationConsistency(invalid)).toThrow(/5 competências/);
  });

  it("rejects a duplicated competency replacing another", () => {
    const invalid = validEvaluation();
    invalid.competencies[4] = { ...invalid.competencies[0] };
    expect(() => validateEvaluationConsistency(invalid)).toThrow(/competência 5 ausente/);
  });

  it("rejects zeroReason with non-zero scores", () => {
    const invalid = validEvaluation();
    invalid.zeroReason = "theme_disconnection";
    expect(() => validateEvaluationConsistency(invalid)).toThrow(/notas iguais a 0/);
  });

  it("accepts zeroReason when every score is zero", () => {
    const zeroed = validEvaluation();
    zeroed.zeroReason = "insufficient_text";
    zeroed.competencies = zeroed.competencies.map((c) => ({ ...c, score: 0 as const }));
    zeroed.annotations = [];
    expect(() => validateEvaluationConsistency(llmEvaluationSchema.parse(zeroed))).not.toThrow();
  });

  it("rejects annotations with an invalid competency number", () => {
    const invalid = validEvaluation();
    invalid.annotations[0].competency = 6 as never;
    expect(() => llmEvaluationSchema.parse(invalid)).toThrow();
  });
});
