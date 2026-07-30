import type { CompetencyNumber, Score } from "./schema";

// CHAMADA 2 (feedback) do pipeline de duas chamadas — spec 018.
// As 5 notas JÁ FORAM decididas pela CHAMADA 1 (prompt v5_calibrated) e são
// IMUTÁVEIS aqui: esta chamada só EXPLICA as notas, escreve o feedback geral, marca
// trechos e — quando a redação foi anulada — classifica o motivo (zeroReason).

export const FEEDBACK_SYSTEM_PROMPT = `Você é um corretor de redações do ENEM escrevendo o retorno para o participante. As cinco notas por competência (C1 a C5) JÁ FORAM ATRIBUÍDAS por outro avaliador e são DEFINITIVAS — você NÃO pode alterá-las, apenas explicá-las de forma fiel.

Competências oficiais do ENEM:
- C1: domínio da modalidade escrita formal da língua portuguesa.
- C2: compreensão da proposta e aplicação de repertório sociocultural produtivo.
- C3: seleção e organização de informações/argumentos em defesa de um ponto de vista.
- C4: conhecimento dos mecanismos linguísticos de coesão.
- C5: proposta de intervenção que respeite os direitos humanos.

Para cada competência, escreva uma justificativa curta em português brasileiro que seja COERENTE com a nota informada (0, 40, 80, 120, 160 ou 200) — descreva o desempenho que corresponde àquela faixa. Nunca contradiga a nota nem sugira que ela deveria ser outra.

ANOTAÇÕES (annotations): aponte trechos específicos do texto com problemas. Cada "excerpt" DEVE ser uma cópia LITERAL, caractere por caractere, de um trecho contíguo da redação (inclusive erros do original) — nunca parafraseie. Prefira trechos curtos (3 a 12 palavras). Em "issue" explique o problema; em "suggestion" proponha a correção concreta. Faça pelo menos 3 anotações quando a redação não estiver anulada e a qualidade permitir. Redações anuladas podem ter zero anotações.

FEEDBACK GERAL (generalFeedback): um parágrafo em português brasileiro com os pontos fortes e as melhorias de maior impacto, em tom construtivo.

zeroReason: se a redação foi informada como ANULADA, classifique o motivo em exatamente um destes valores e explique-o no feedback geral:
- "insufficient_text": texto insuficiente, em branco, ou só cópia dos textos motivadores.
- "genre_disregard": desrespeito à estrutura dissertativo-argumentativa (poema, lista, narração pura, carta).
- "theme_disconnection": fuga completa ao tema proposto.
Se a redação NÃO foi anulada, use "none". Não invente anulação: confie na informação de anulação recebida.`;

function scoreLine(scores: Record<CompetencyNumber, Score>): string {
  return ([1, 2, 3, 4, 5] as CompetencyNumber[]).map((c) => `C${c}: ${scores[c]}`).join("\n");
}

export function buildFeedbackUserMessage(
  theme: string,
  essayText: string,
  scores: Record<CompetencyNumber, Score>,
  annulled: boolean,
): string {
  return `TEMA DA REDAÇÃO: ${theme}

NOTAS DEFINITIVAS (não alterar):
${scoreLine(scores)}
REDAÇÃO ANULADA: ${annulled ? "sim" : "não"}

TEXTO DA REDAÇÃO (transcrito da versão manuscrita e confirmado pelo participante):

${essayText}`;
}

// Espelha feedbackEvaluationSchema (schema.ts) no formato JSON Schema aceito pelo
// responseJsonSchema do Gemini. zeroReason usa o sentinela "none" (em vez de null),
// pois enums anuláveis são frágeis na geração controlada; o provider remapeia
// "none" -> null antes da validação Zod. As notas NÃO fazem parte deste schema.
export const GEMINI_FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    zeroReason: {
      type: "string",
      enum: ["none", "insufficient_text", "genre_disregard", "theme_disconnection"],
      description: 'Motivo oficial de anulação; use "none" quando a redação não foi anulada.',
    },
    competencies: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          competency: { type: "integer", enum: [1, 2, 3, 4, 5] },
          justification: { type: "string" },
        },
        required: ["competency", "justification"],
        propertyOrdering: ["competency", "justification"],
      },
    },
    generalFeedback: { type: "string" },
    annotations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          competency: { type: "integer", enum: [1, 2, 3, 4, 5] },
          excerpt: { type: "string" },
          issue: { type: "string" },
          suggestion: { type: "string" },
        },
        required: ["competency", "excerpt", "issue", "suggestion"],
        propertyOrdering: ["competency", "excerpt", "issue", "suggestion"],
      },
    },
  },
  required: ["zeroReason", "competencies", "generalFeedback", "annotations"],
  propertyOrdering: ["zeroReason", "competencies", "generalFeedback", "annotations"],
};
