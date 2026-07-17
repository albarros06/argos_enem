import { ImageAnnotatorClient, protos } from "@google-cloud/vision";
import { env, fakeVendorsEnabled } from "@/lib/config";

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

export interface TranscriptionProvider {
  extract(image: Buffer): Promise<TranscriptionResult>;
  extractPdf(pdf: Buffer): Promise<PdfTranscriptionResult>;
}

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

class VisionTranscriptionProvider implements TranscriptionProvider {
  private client = new ImageAnnotatorClient({
    credentials: JSON.parse(env().GOOGLE_APPLICATION_CREDENTIALS_JSON),
  });

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

class FakeTranscriptionProvider implements TranscriptionProvider {
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

let cached: TranscriptionProvider | null = null;

export function transcriptionProvider(): TranscriptionProvider {
  if (!cached) {
    cached = fakeVendorsEnabled()
      ? new FakeTranscriptionProvider()
      : new VisionTranscriptionProvider();
  }
  return cached;
}
