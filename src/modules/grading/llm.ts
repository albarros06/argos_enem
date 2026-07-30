import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { business, env, fakeVendorsEnabled } from "@/lib/config";
import { logger } from "@/lib/logger";
import { isRateLimitError, withRetry } from "@/lib/retry";
import { vertexClient } from "@/lib/vertex";
import { buildGradingUserMessage, RUBRIC_SYSTEM_PROMPT } from "./rubric";
import { scoringSystemInstruction, buildScoringMessage } from "./scoringPrompt";
import {
  FEEDBACK_SYSTEM_PROMPT,
  buildFeedbackUserMessage,
  GEMINI_FEEDBACK_SCHEMA,
} from "./feedbackPrompt";
import { parseScoreBlock } from "./scoreParser";
import {
  feedbackEvaluationSchema,
  llmEvaluationSchema,
  type CompetencyNumber,
  type FeedbackResult,
  type LlmEvaluation,
  type Score,
  type ScoringResult,
} from "./schema";

// Re-exportado para compatibilidade: a resolução de credencial Vertex mora em
// @/lib/vertex (compartilhada entre grading e OCR via Gemini).
export { resolveVertexClientConfig, type VertexClientConfig } from "@/lib/vertex";

export interface GradingInput {
  theme: string;
  essayText: string;
}

// Entrada da CHAMADA 2 (feedback): a redação mais as notas JÁ fixadas pela CHAMADA 1.
export interface FeedbackInput extends GradingInput {
  scores: Record<CompetencyNumber, Score>;
  annulled: boolean;
}

export interface GradingProvider {
  // Caminho legado de uma chamada (scripts/harness) — não usado no pipeline de produção.
  grade(input: GradingInput): Promise<LlmEvaluation>;
  // Pipeline de duas chamadas (spec 018).
  scoreEssay(input: GradingInput): Promise<ScoringResult>;
  generateFeedback(input: FeedbackInput): Promise<FeedbackResult>;
}

const COMPETENCIES: CompetencyNumber[] = [1, 2, 3, 4, 5];

class AnthropicGradingProvider implements GradingProvider {
  private client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });

  async grade(input: GradingInput): Promise<LlmEvaluation> {
    const response = await logger.vendorCall("anthropic", "grade_essay", () =>
      withRetry(
        () =>
          this.client.messages.parse({
            model: business.gradingModelId,
            max_tokens: business.gradingMaxOutputTokens,
            system: [
              {
                type: "text",
                text: RUBRIC_SYSTEM_PROMPT,
                // Rubrica congelada: cache de prompt corta ~90% do custo de input (R3).
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [
              { role: "user", content: buildGradingUserMessage(input.theme, input.essayText) },
            ],
            output_config: {
              format: zodOutputFormat(llmEvaluationSchema),
            },
          }),
        { isRetryable: isRateLimitError },
      ),
    );
    if (!response.parsed_output) {
      throw new Error(`Saída do modelo não parseável (stop_reason: ${response.stop_reason})`);
    }
    return response.parsed_output;
  }

  // O pipeline de duas chamadas (spec 018) é validado só no Gemini: a config da CHAMADA 1
  // (pensamento dinâmico + teto de 32768) é específica do Gemini e o número de QWK foi
  // medido em gemini-2.5-flash. Não construímos um caminho Anthropic especulativo
  // (Constituição II). Produção seleciona o Gemini pelo prefixo do gradingModelId.
  async scoreEssay(): Promise<ScoringResult> {
    throw new Error(
      "Correção em duas chamadas não é suportada no provider Anthropic (use um modelo gemini-*).",
    );
  }

  async generateFeedback(): Promise<FeedbackResult> {
    throw new Error(
      "Correção em duas chamadas não é suportada no provider Anthropic (use um modelo gemini-*).",
    );
  }
}

// Espelha llmEvaluationSchema (schema.ts) no formato JSON Schema aceito pelo
// responseJsonSchema do Gemini. zeroReason usa o sentinela "none" (em vez de null),
// pois enums anuláveis são frágeis na geração controlada; o provider remapeia
// "none" -> null antes da validação Zod.
const GEMINI_EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    zeroReason: {
      type: "string",
      enum: ["none", "insufficient_text", "genre_disregard", "theme_disconnection"],
      description: 'Condição oficial de nota zero do ENEM; use "none" quando nenhuma se aplica.',
    },
    competencies: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          competency: { type: "integer", enum: [1, 2, 3, 4, 5] },
          score: { type: "integer", enum: [0, 40, 80, 120, 160, 200] },
          justification: { type: "string" },
        },
        required: ["competency", "score", "justification"],
        propertyOrdering: ["competency", "score", "justification"],
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

class GeminiGradingProvider implements GradingProvider {
  private location = env().GOOGLE_CLOUD_LOCATION;
  // Vertex AI com a service account já usada no OCR — sem chave de API própria.
  private client = vertexClient();

  async grade(input: GradingInput): Promise<LlmEvaluation> {
    const response = await logger.vendorCall("gemini", "grade_essay", () =>
      withRetry(
        () =>
          this.client.models.generateContent({
            model: business.gradingModelId,
            contents: buildGradingUserMessage(input.theme, input.essayText),
            config: {
              // Rubrica congelada como instrução de sistema: o cache implícito do
              // Gemini reaproveita esse prefixo estável entre chamadas (R3).
              systemInstruction: RUBRIC_SYSTEM_PROMPT,
              responseMimeType: "application/json",
              responseJsonSchema: GEMINI_EVALUATION_SCHEMA,
              temperature: 0, // correção reprodutível
              maxOutputTokens: business.gradingMaxOutputTokens,
            },
          }),
        { isRetryable: isRateLimitError },
      ).catch((error: unknown) => {
        // Contexto de modelo/região ajuda a diagnosticar indisponibilidade do
        // modelo na região configurada (FR-012) e falhas de permissão.
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Falha ao chamar o Vertex AI (modelo: ${business.gradingModelId}, região: ${this.location}): ${detail}`,
        );
      }),
    );

    const text = response.text;
    if (!text) {
      const reason = response.candidates?.[0]?.finishReason ?? "desconhecido";
      throw new Error(`Gemini retornou resposta vazia (finishReason: ${reason})`);
    }
    return parseGeminiEvaluation(text);
  }

  // CHAMADA 1 (pontuação): prompt v5_calibrated, pensamento dinâmico, saída em texto
  // livre terminando no bloco ANNULLED/C1..C5. SEM responseJsonSchema (a calibração
  // depende do raciocínio livre). Config validada em gemini-2.5-flash (QWK 0.541).
  async scoreEssay(input: GradingInput): Promise<ScoringResult> {
    const response = await logger.vendorCall("gemini", "score_essay", () =>
      withRetry(
        () =>
          this.client.models.generateContent({
            model: business.gradingModelId,
            contents: buildScoringMessage(input.theme, input.essayText),
            config: {
              systemInstruction: scoringSystemInstruction(),
              thinkingConfig: { thinkingBudget: -1 }, // pensamento dinâmico (maior ganho de QWK)
              temperature: 0,
              maxOutputTokens: business.gradingMaxOutputTokens,
            },
          }),
        { isRetryable: isRateLimitError },
      ).catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Falha ao pontuar no Vertex AI (modelo: ${business.gradingModelId}, região: ${this.location}): ${detail}`,
        );
      }),
    );
    const text = response.text;
    if (!text) {
      const reason = response.candidates?.[0]?.finishReason ?? "desconhecido";
      throw new Error(`Gemini retornou pontuação vazia (finishReason: ${reason})`);
    }
    return parseScoreBlock(text);
  }

  // CHAMADA 2 (feedback): modelo mais barato, JSON estruturado. Só EXPLICA as notas já
  // fixadas e classifica o zeroReason quando a redação foi anulada.
  async generateFeedback(input: FeedbackInput): Promise<FeedbackResult> {
    const response = await logger.vendorCall("gemini", "generate_feedback", () =>
      withRetry(
        () =>
          this.client.models.generateContent({
            model: business.feedbackModelId,
            contents: buildFeedbackUserMessage(
              input.theme,
              input.essayText,
              input.scores,
              input.annulled,
            ),
            config: {
              systemInstruction: FEEDBACK_SYSTEM_PROMPT,
              responseMimeType: "application/json",
              responseJsonSchema: GEMINI_FEEDBACK_SCHEMA,
              temperature: 0,
              maxOutputTokens: business.feedbackMaxOutputTokens,
            },
          }),
        { isRetryable: isRateLimitError },
      ).catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Falha ao gerar feedback no Vertex AI (modelo: ${business.feedbackModelId}, região: ${this.location}): ${detail}`,
        );
      }),
    );
    const text = response.text;
    if (!text) {
      const reason = response.candidates?.[0]?.finishReason ?? "desconhecido";
      throw new Error(`Gemini retornou feedback vazio (finishReason: ${reason})`);
    }
    return parseGeminiFeedback(text);
  }
}

// Converte o texto JSON de feedback do Gemini em FeedbackResult validado. Remapeia o
// sentinela "none" -> null e garante uma justificativa por competência (1 a 5).
export function parseGeminiFeedback(text: string): FeedbackResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Saída de feedback do Gemini não é JSON válido");
  }
  if (raw && typeof raw === "object" && (raw as { zeroReason?: unknown }).zeroReason === "none") {
    (raw as { zeroReason: unknown }).zeroReason = null;
  }
  const parsed = feedbackEvaluationSchema.parse(raw);
  const justifications = {} as Record<CompetencyNumber, string>;
  for (const c of COMPETENCIES) {
    const item = parsed.competencies.find((x) => x.competency === c);
    if (!item) {
      throw new Error(`Feedback inválido: justificativa da competência ${c} ausente`);
    }
    justifications[c] = item.justification;
  }
  return {
    zeroReason: parsed.zeroReason,
    justifications,
    generalFeedback: parsed.generalFeedback,
    annotations: parsed.annotations,
  };
}

// Converte o texto JSON do Gemini em LlmEvaluation validado. Preserva o contrato
// entre backends (FR-004): remapeia o sentinela "none" -> null antes do Zod e
// nunca devolve avaliação malformada — JSON inválido ou fora do schema lança.
export function parseGeminiEvaluation(text: string): LlmEvaluation {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Saída do Gemini não é JSON válido");
  }
  // Remapeia o sentinela "none" -> null para casar com llmEvaluationSchema.
  if (raw && typeof raw === "object" && (raw as { zeroReason?: unknown }).zeroReason === "none") {
    (raw as { zeroReason: unknown }).zeroReason = null;
  }
  return llmEvaluationSchema.parse(raw);
}

// Fake determinístico para testes e E2E — sem chamadas externas (quickstart).
// Três filas: a compartilhada (LlmEvaluation, dirige AS DUAS chamadas do pipeline e o
// grade() legado) e as granulares por chamada — para testar, por ex., um feedback que
// falha sobre uma pontuação bem-sucedida (caminho degradado da spec 018).
const globalForGrading = globalThis as unknown as {
  fakeGradingQueue?: (LlmEvaluation | Error)[];
  fakeScoringQueue?: (ScoringResult | Error)[];
  fakeFeedbackQueue?: (FeedbackResult | Error)[];
  fakePendingFeedback?: LlmEvaluation[];
};

function fakeQueue(): (LlmEvaluation | Error)[] {
  globalForGrading.fakeGradingQueue ??= [];
  return globalForGrading.fakeGradingQueue;
}

function fakeScoringQueue(): (ScoringResult | Error)[] {
  globalForGrading.fakeScoringQueue ??= [];
  return globalForGrading.fakeScoringQueue;
}

function fakeFeedbackQueue(): (FeedbackResult | Error)[] {
  globalForGrading.fakeFeedbackQueue ??= [];
  return globalForGrading.fakeFeedbackQueue;
}

// Quando scoreEssay() consome uma LlmEvaluation da fila compartilhada, guarda-a aqui
// para que generateFeedback() reconstrua o feedback da MESMA avaliação.
function pendingFeedback(): LlmEvaluation[] {
  globalForGrading.fakePendingFeedback ??= [];
  return globalForGrading.fakePendingFeedback;
}

export function enqueueFakeGradingResult(result: LlmEvaluation | Error) {
  fakeQueue().push(result);
}

export function enqueueFakeScoringResult(result: ScoringResult | Error) {
  fakeScoringQueue().push(result);
}

export function enqueueFakeFeedbackResult(result: FeedbackResult | Error) {
  fakeFeedbackQueue().push(result);
}

export function defaultFakeEvaluation(essayText: string): LlmEvaluation {
  const words = essayText.split(/\s+/).filter(Boolean);
  const excerptA = words.slice(0, 4).join(" ");
  const excerptB = words.slice(8, 13).join(" ") || excerptA;
  const excerptC = words.slice(20, 24).join(" ") || excerptA;
  return {
    zeroReason: null,
    competencies: [
      {
        competency: 1,
        score: 160,
        justification: "Bom domínio da norma culta, com poucos desvios.",
      },
      {
        competency: 2,
        score: 160,
        justification: "Argumentação consistente com bom domínio do gênero.",
      },
      { competency: 3, score: 120, justification: "Argumentos organizados, porém previsíveis." },
      {
        competency: 4,
        score: 160,
        justification: "Boa articulação com repertório coesivo diversificado.",
      },
      {
        competency: 5,
        score: 120,
        justification: "Proposta de intervenção com 3 elementos válidos.",
      },
    ],
    generalFeedback:
      "Texto bem estruturado com argumentação clara. Para evoluir, aprofunde o repertório sociocultural e detalhe melhor a proposta de intervenção.",
    annotations: [
      {
        competency: 1,
        excerpt: excerptA,
        issue: "Construção que pode ser refinada para a norma culta.",
        suggestion: "Revise a concordância e a pontuação deste trecho.",
      },
      {
        competency: 3,
        excerpt: excerptB,
        issue: "Argumento pouco desenvolvido.",
        suggestion: "Acrescente um dado ou exemplo concreto que sustente a afirmação.",
      },
      {
        competency: 4,
        excerpt: excerptC,
        issue: "Transição abrupta entre ideias.",
        suggestion:
          "Use um conectivo (por exemplo: 'além disso', 'portanto') para articular os períodos.",
      },
    ],
  };
}

// Deriva as saídas das duas chamadas a partir de uma LlmEvaluation completa (o formato
// que enqueueFakeGradingResult usa) — mantém os testes de integração existentes válidos.
function scoringFromEvaluation(ev: LlmEvaluation): ScoringResult {
  const scores = {} as Record<CompetencyNumber, Score>;
  for (const c of COMPETENCIES) {
    scores[c] = (ev.competencies.find((x) => x.competency === c)?.score ?? 0) as Score;
  }
  return { annulled: ev.zeroReason !== null, scores };
}

function feedbackFromEvaluation(ev: LlmEvaluation): FeedbackResult {
  const justifications = {} as Record<CompetencyNumber, string>;
  for (const c of COMPETENCIES) {
    justifications[c] = ev.competencies.find((x) => x.competency === c)?.justification ?? "";
  }
  return {
    zeroReason: ev.zeroReason,
    justifications,
    generalFeedback: ev.generalFeedback,
    annotations: ev.annotations,
  };
}

export function defaultFakeScoringResult(essayText: string): ScoringResult {
  return scoringFromEvaluation(defaultFakeEvaluation(essayText));
}

export function defaultFakeFeedbackResult(essayText: string): FeedbackResult {
  return feedbackFromEvaluation(defaultFakeEvaluation(essayText));
}

class FakeGradingProvider implements GradingProvider {
  async grade(input: GradingInput): Promise<LlmEvaluation> {
    const queued = fakeQueue().shift();
    if (queued instanceof Error) {
      throw queued;
    }
    return queued ?? defaultFakeEvaluation(input.essayText);
  }

  async scoreEssay(input: GradingInput): Promise<ScoringResult> {
    const scoped = fakeScoringQueue().shift();
    if (scoped instanceof Error) throw scoped;
    if (scoped) return scoped;
    // Sem fila granular: consome a fila compartilhada e guarda a avaliação para a CHAMADA 2.
    const shared = fakeQueue().shift();
    if (shared instanceof Error) throw shared;
    const ev = shared ?? defaultFakeEvaluation(input.essayText);
    pendingFeedback().push(ev);
    return scoringFromEvaluation(ev);
  }

  async generateFeedback(input: FeedbackInput): Promise<FeedbackResult> {
    const scoped = fakeFeedbackQueue().shift();
    if (scoped instanceof Error) throw scoped;
    if (scoped) return scoped;
    const ev = pendingFeedback().shift();
    return ev ? feedbackFromEvaluation(ev) : defaultFakeFeedbackResult(input.essayText);
  }
}

export type GradingProviderKind = "fake" | "gemini" | "anthropic";

// Seleção do provider por ambiente: fake para testes/E2E; caso contrário o
// prefixo do modelo decide (gemini-* -> Vertex AI, claude-* -> Anthropic).
export function gradingProviderKind(fake: boolean, modelId: string): GradingProviderKind {
  if (fake) return "fake";
  return modelId.startsWith("gemini") ? "gemini" : "anthropic";
}

let cached: GradingProvider | null = null;

export function gradingProvider(): GradingProvider {
  if (!cached) {
    switch (gradingProviderKind(fakeVendorsEnabled(), business.gradingModelId)) {
      case "fake":
        cached = new FakeGradingProvider();
        break;
      case "gemini":
        cached = new GeminiGradingProvider();
        break;
      case "anthropic":
        cached = new AnthropicGradingProvider();
        break;
    }
  }
  return cached;
}
