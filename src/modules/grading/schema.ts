import { z } from "zod";

// Mirrors contracts/evaluation-llm.schema.json — doubles as the structured-output
// schema sent to the LLM (via zodOutputFormat) and the server-side re-validation.
export const competencyScoreSchema = z.union([
  z.literal(0),
  z.literal(40),
  z.literal(80),
  z.literal(120),
  z.literal(160),
  z.literal(200),
]);

export const llmAnnotationSchema = z.object({
  competency: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  excerpt: z
    .string()
    .describe(
      "Trecho LITERAL copiado caractere por caractere do texto da redação. O servidor o localiza para calcular os offsets de destaque.",
    ),
  issue: z.string().describe("O que está errado neste trecho."),
  suggestion: z.string().describe("Correção concreta sugerida."),
});

export const llmEvaluationSchema = z.object({
  zeroReason: z
    .union([z.null(), z.enum(["insufficient_text", "genre_disregard", "theme_disconnection"])])
    .describe(
      "Não-nulo apenas quando uma condição oficial de nota zero do ENEM se aplica; nesse caso todas as notas devem ser 0.",
    ),
  competencies: z
    .array(
      z.object({
        competency: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
        score: competencyScoreSchema,
        justification: z
          .string()
          .describe(
            "Um parágrafo curto, em português brasileiro, citando o descritor de nível da rubrica correspondente.",
          ),
      }),
    )
    .describe("Exatamente 5 itens, competências 1 a 5, em ordem."),
  generalFeedback: z
    .string()
    .describe("Pontos fortes gerais e melhorias de maior impacto, em português brasileiro."),
  annotations: z
    .array(llmAnnotationSchema)
    .describe(
      "Correções pontuais ancoradas no texto. Pelo menos 3 quando a qualidade do texto permitir; pode ser vazio apenas em redações zeradas.",
    ),
});

export type LlmEvaluation = z.infer<typeof llmEvaluationSchema>;
export type LlmAnnotation = z.infer<typeof llmAnnotationSchema>;

// Constraints JSON Schema can't express; enforced after parse.
export function validateEvaluationConsistency(evaluation: LlmEvaluation): LlmEvaluation {
  if (evaluation.competencies.length !== 5) {
    throw new Error(
      `Avaliação inválida: esperava 5 competências, recebeu ${evaluation.competencies.length}`,
    );
  }
  const numbers = evaluation.competencies.map((c) => c.competency);
  for (let i = 1; i <= 5; i++) {
    if (!numbers.includes(i as 1 | 2 | 3 | 4 | 5)) {
      throw new Error(`Avaliação inválida: competência ${i} ausente`);
    }
  }
  if (evaluation.zeroReason && evaluation.competencies.some((c) => c.score !== 0)) {
    throw new Error("Avaliação inválida: zeroReason exige todas as notas iguais a 0");
  }
  return evaluation;
}
