import { ImageAnnotatorClient, protos } from "@google-cloud/vision";
import { ThinkingLevel } from "@google/genai";
import { business, env, fakeVendorsEnabled } from "@/lib/config";
import { logger } from "@/lib/logger";
import { isRateLimitError, withRetry } from "@/lib/retry";
import { vertexClient } from "@/lib/vertex";

type FullTextAnnotation = protos.google.cloud.vision.v1.ITextAnnotation;

export interface TranscriptionResult {
  text: string;
  meanConfidence: number;
}

// PDF extraction também informa o total de páginas do arquivo, para rejeitar
// documentos com mais de uma página antes da revisão (FR-011).
export interface PdfTranscriptionResult extends TranscriptionResult {
  totalPages: number;
}

// OCR de imagens: Vision (pixel) ou Gemini (LLM). A transcrição por LLM entende
// o que ignorar — linhas impressas e numeração da margem — o que o OCR pixel a
// pixel não consegue.
export interface ImageTranscriptionProvider {
  extract(image: Buffer, mimeType: string): Promise<TranscriptionResult>;
}

// Vision (batchAnnotateFiles) é a fonte determinística de totalPages, base da
// rejeição de PDF com mais de uma página (FR-011). A transcrição do texto pode
// ser reencaminhada ao motor de imagem (Gemini) em extractFromStorage.
export interface PdfTranscriptionProvider {
  extractPdf(pdf: Buffer): Promise<PdfTranscriptionResult>;
}

// Prompt de transcrição verbatim. A fidelidade é crítica: a Competência 1 avalia
// ortografia/gramática, então o modelo NÃO pode corrigir os erros do aluno.
const TRANSCRIPTION_PROMPT = `Transcreva EXATAMENTE o texto manuscrito desta redação, linha por linha.
Regras obrigatórias:
1. Ignore completamente as linhas impressas do papel e a numeração das linhas na margem — elas não fazem parte da redação.
2. NÃO corrija ortografia, gramática, acentuação nem pontuação. Transcreva os erros do aluno exatamente como aparecem — eles são avaliados.
3. Preserve as quebras de linha do texto escrito.
4. Não adicione títulos, comentários ou explicações. Devolva apenas o texto transcrito.
5. Se a imagem não contiver texto manuscrito legível, devolva uma string vazia.`;

// Média das confianças por palavra de uma fullTextAnnotation do Vision. Mesmo
// cálculo para foto e PDF — uma única porta de qualidade (FR-013).
function meanWordConfidence(annotation: FullTextAnnotation): number {
  const confidences: number[] = [];
  for (const page of annotation.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const word of paragraph.words ?? []) {
          if (typeof word.confidence === "number") {
            confidences.push(word.confidence);
          }
        }
      }
    }
  }
  return confidences.length > 0
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : 0;
}

class VisionTranscriptionProvider implements ImageTranscriptionProvider, PdfTranscriptionProvider {
  private client = new ImageAnnotatorClient({
    credentials: JSON.parse(env().GOOGLE_APPLICATION_CREDENTIALS_JSON),
  });

  // mimeType não é usado: documentTextDetection recebe os bytes diretamente.
  async extract(image: Buffer): Promise<TranscriptionResult> {
    const [result] = await this.client.documentTextDetection({
      image: { content: image },
      imageContext: { languageHints: ["pt"] },
    });
    const annotation = result.fullTextAnnotation;
    if (!annotation?.text) {
      return { text: "", meanConfidence: 0 };
    }
    return { text: annotation.text, meanConfidence: meanWordConfidence(annotation) };
  }

  // PDF não é aceito por documentTextDetection (só imagens). batchAnnotateFiles
  // rasteriza a página e roda OCR, ignorando qualquer camada de texto (FR-013),
  // e reporta totalPages do arquivo. Só a página 1 é anotada.
  async extractPdf(pdf: Buffer): Promise<PdfTranscriptionResult> {
    const [result] = await this.client.batchAnnotateFiles({
      requests: [
        {
          inputConfig: { mimeType: "application/pdf", content: pdf },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["pt"] },
          pages: [1],
        },
      ],
    });
    const fileResponse = result.responses?.[0];
    const totalPages = fileResponse?.totalPages ?? 0;
    const annotation = fileResponse?.responses?.[0]?.fullTextAnnotation;
    if (!annotation?.text) {
      return { text: "", meanConfidence: 0, totalPages };
    }
    return { text: annotation.text, meanConfidence: meanWordConfidence(annotation), totalPages };
  }
}

// Transcrição por LLM (Vertex AI). Enviamos a imagem + o prompt verbatim; o
// modelo ignora as linhas/numeração impressas e não corrige os erros do aluno.
class GeminiImageTranscriptionProvider implements ImageTranscriptionProvider {
  private client = vertexClient();

  async extract(image: Buffer, mimeType: string): Promise<TranscriptionResult> {
    const response = await withRetry(
      () =>
        this.client.models.generateContent({
          model: business.imageOcrModelId,
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType, data: image.toString("base64") } },
                { text: TRANSCRIPTION_PROMPT },
              ],
            },
          ],
          config: {
            temperature: 0, // transcrição reprodutível
            responseMimeType: "text/plain",
            maxOutputTokens: business.imageOcrMaxOutputTokens,
            // Transcrição é cópia verbatim — não precisa de raciocínio. Sem isso, o
            // "thinking" do Gemini 3 consome quase todo o maxOutputTokens e trunca o
            // texto (finishReason MAX_TOKENS). LOW deixa o orçamento para o texto.
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      { isRetryable: isRateLimitError },
    );
    // Visibilidade do custo/truncamento: finishReason e quanto foi pensamento vs texto.
    const usage = response.usageMetadata;
    logger.info("image_ocr_usage", {
      model: business.imageOcrModelId,
      finishReason: response.candidates?.[0]?.finishReason,
      thoughtsTokens: usage?.thoughtsTokenCount,
      outputTokens: usage?.candidatesTokenCount,
    });
    const text = response.text?.trim() ?? "";
    // Um LLM não devolve confiança por palavra. A porta de qualidade passa a ser
    // o mínimo de linhas + a revisão do aluno; sinalizamos 1 quando há texto e 0
    // quando a imagem é ilegível (o modelo devolve vazio).
    return { text, meanConfidence: text ? 1 : 0 };
  }
}

export const FAKE_ESSAY_TEXT = `A persistência da desigualdade educacional no Brasil revela um desafio histórico ainda não superado.
Embora a Constituição de 1988 garanta a educação como direito de todos, a realidade das escolas públicas evidencia um abismo entre a lei e a prática.
Em primeiro lugar, a infraestrutura precária de muitas instituições compromete o aprendizado dos estudantes.
Segundo dados do próprio governo, milhares de escolas ainda carecem de bibliotecas, laboratórios e acesso à internet.
Além disso, a desvalorização dos professores agrava o problema, afastando profissionais qualificados da carreira docente.
O filósofo Paulo Freire defendia que a educação é o caminho para a transformação social, o que reforça a urgência de enfrentar essas carências.
Portanto, é necessário que o Ministério da Educação, em parceria com estados e municípios, amplie os investimentos em infraestrutura escolar, por meio de um plano nacional com metas fiscalizáveis, a fim de garantir igualdade de oportunidades.
Somente assim o país poderá transformar o direito constitucional à educação em realidade concreta para todos os brasileiros.`;

const globalForTranscription = globalThis as unknown as {
  fakeTranscriptionQueue?: (TranscriptionResult | Error)[];
  fakePdfQueue?: (PdfTranscriptionResult | Error)[];
};

function fakeQueue(): (TranscriptionResult | Error)[] {
  globalForTranscription.fakeTranscriptionQueue ??= [];
  return globalForTranscription.fakeTranscriptionQueue;
}

function fakePdfQueue(): (PdfTranscriptionResult | Error)[] {
  globalForTranscription.fakePdfQueue ??= [];
  return globalForTranscription.fakePdfQueue;
}

export function enqueueFakeTranscriptionResult(result: TranscriptionResult | Error) {
  fakeQueue().push(result);
}

export function enqueueFakePdfResult(result: PdfTranscriptionResult | Error) {
  fakePdfQueue().push(result);
}

class FakeTranscriptionProvider implements ImageTranscriptionProvider, PdfTranscriptionProvider {
  async extract(): Promise<TranscriptionResult> {
    const queued = fakeQueue().shift();
    if (queued instanceof Error) {
      throw queued;
    }
    return queued ?? { text: FAKE_ESSAY_TEXT, meanConfidence: 0.92 };
  }

  async extractPdf(): Promise<PdfTranscriptionResult> {
    const queued = fakePdfQueue().shift();
    if (queued instanceof Error) {
      throw queued;
    }
    return queued ?? { text: FAKE_ESSAY_TEXT, meanConfidence: 0.92, totalPages: 1 };
  }
}

export type ImageOcrKind = "fake" | "gemini" | "vision";

// Seleção do OCR de imagem: fake em testes/E2E; caso contrário o prefixo do
// modelo decide (gemini-* -> transcrição por LLM, qualquer outro -> Vision).
export function imageOcrKind(fake: boolean, modelId: string): ImageOcrKind {
  if (fake) return "fake";
  return modelId.startsWith("gemini") ? "gemini" : "vision";
}

let cachedFake: FakeTranscriptionProvider | null = null;
let cachedImage: ImageTranscriptionProvider | null = null;
let cachedPdf: PdfTranscriptionProvider | null = null;

function fakeProvider(): FakeTranscriptionProvider {
  if (!cachedFake) cachedFake = new FakeTranscriptionProvider();
  return cachedFake;
}

export function imageTranscriptionProvider(): ImageTranscriptionProvider {
  if (!cachedImage) {
    switch (imageOcrKind(fakeVendorsEnabled(), business.imageOcrModelId)) {
      case "fake":
        cachedImage = fakeProvider();
        break;
      case "gemini":
        cachedImage = new GeminiImageTranscriptionProvider();
        break;
      case "vision":
        cachedImage = new VisionTranscriptionProvider();
        break;
    }
  }
  return cachedImage;
}

// PDF: Vision fora dos testes — é a fonte de totalPages (FR-011). A transcrição
// pode seguir para o Gemini (ver extractFromStorage); aqui garantimos a contagem.
export function pdfTranscriptionProvider(): PdfTranscriptionProvider {
  if (!cachedPdf) {
    cachedPdf = fakeVendorsEnabled() ? fakeProvider() : new VisionTranscriptionProvider();
  }
  return cachedPdf;
}

// Para ferramentas de comparação (scripts/compare-ocr): instancia um motor de OCR
// de imagem específico, sem cache e sem a seleção por config.
export function imageProviderFor(kind: "gemini" | "vision"): ImageTranscriptionProvider {
  return kind === "gemini"
    ? new GeminiImageTranscriptionProvider()
    : new VisionTranscriptionProvider();
}
