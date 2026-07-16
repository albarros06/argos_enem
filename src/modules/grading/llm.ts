import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI } from "@google/genai";
import { business, env, fakeVendorsEnabled } from "@/lib/config";
import { logger } from "@/lib/logger";
import { buildGradingUserMessage, RUBRIC_SYSTEM_PROMPT } from "./rubric";
import { llmEvaluationSchema, type LlmEvaluation } from "./schema";

export interface GradingInput {
  theme: string;
  essayText: string;
}

export interface GradingProvider {
  grade(input: GradingInput): Promise<LlmEvaluation>;
}

class AnthropicGradingProvider implements GradingProvider {
  private client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });

  async grade(input: GradingInput): Promise<LlmEvaluation> {
    const response = await logger.vendorCall("anthropic", "grade_essay", () =>
      this.client.messages.parse({
        model: business.gradingModelId,
        max_tokens: 8192,
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
    );
    if (!response.parsed_output) {
      throw new Error(`Saída do modelo não parseável (stop_reason: ${response.stop_reason})`);
    }
    return response.parsed_output;
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

export interface VertexClientConfig {
  vertexai: true;
  project: string;
  location: string;
  googleAuthOptions: { credentials: Record<string, unknown> };
}

// Deriva a configuração do cliente Vertex AI a partir do ambiente. Falha com
// mensagem acionável quando falta credencial, o JSON é inválido, ou não há
// projeto (nem GOOGLE_CLOUD_PROJECT nem project_id na credencial) — FR-008.
// O projeto vem de GOOGLE_CLOUD_PROJECT ou, na ausência, do project_id da
// própria credencial de serviço (a mesma usada no OCR).
export function resolveVertexClientConfig(
  credentialsJson: string,
  projectOverride: string,
  location: string,
): VertexClientConfig {
  if (!credentialsJson) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON ausente: necessário para autenticar o grading no Vertex AI.",
    );
  }
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON inválido: não é um JSON válido.");
  }
  const credentialProject =
    typeof credentials.project_id === "string" ? credentials.project_id : "";
  const project = projectOverride || credentialProject;
  if (!project) {
    throw new Error(
      "Projeto do Vertex AI indeterminado: defina GOOGLE_CLOUD_PROJECT ou inclua project_id na credencial de serviço.",
    );
  }
  return { vertexai: true, project, location, googleAuthOptions: { credentials } };
}

class GeminiGradingProvider implements GradingProvider {
  private location = env().GOOGLE_CLOUD_LOCATION;
  // Vertex AI com a service account já usada no OCR — sem chave de API própria.
  private client = new GoogleGenAI(
    resolveVertexClientConfig(
      env().GOOGLE_APPLICATION_CREDENTIALS_JSON,
      env().GOOGLE_CLOUD_PROJECT,
      this.location,
    ),
  );

  async grade(input: GradingInput): Promise<LlmEvaluation> {
    const response = await logger.vendorCall("gemini", "grade_essay", () =>
      this.client.models
        .generateContent({
          model: business.gradingModelId,
          contents: buildGradingUserMessage(input.theme, input.essayText),
          config: {
            // Rubrica congelada como instrução de sistema: o cache implícito do
            // Gemini reaproveita esse prefixo estável entre chamadas (R3).
            systemInstruction: RUBRIC_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseJsonSchema: GEMINI_EVALUATION_SCHEMA,
            temperature: 0, // correção reprodutível
            maxOutputTokens: 8192,
          },
        })
        .catch((error: unknown) => {
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
const globalForGrading = globalThis as unknown as {
  fakeGradingQueue?: (LlmEvaluation | Error)[];
};

function fakeQueue(): (LlmEvaluation | Error)[] {
  globalForGrading.fakeGradingQueue ??= [];
  return globalForGrading.fakeGradingQueue;
}

export function enqueueFakeGradingResult(result: LlmEvaluation | Error) {
  fakeQueue().push(result);
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

class FakeGradingProvider implements GradingProvider {
  async grade(input: GradingInput): Promise<LlmEvaluation> {
    const queued = fakeQueue().shift();
    if (queued instanceof Error) {
      throw queued;
    }
    return queued ?? defaultFakeEvaluation(input.essayText);
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
