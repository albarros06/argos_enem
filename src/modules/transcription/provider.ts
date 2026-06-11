import { ImageAnnotatorClient } from "@google-cloud/vision";
import { env, fakeVendorsEnabled } from "@/lib/config";

export interface TranscriptionResult {
  text: string;
  meanConfidence: number;
}

export interface TranscriptionProvider {
  extract(image: Buffer): Promise<TranscriptionResult>;
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
    const meanConfidence =
      confidences.length > 0
        ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
        : 0;
    return { text: annotation.text, meanConfidence };
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
};

function fakeQueue(): (TranscriptionResult | Error)[] {
  globalForTranscription.fakeTranscriptionQueue ??= [];
  return globalForTranscription.fakeTranscriptionQueue;
}

export function enqueueFakeTranscriptionResult(result: TranscriptionResult | Error) {
  fakeQueue().push(result);
}

class FakeTranscriptionProvider implements TranscriptionProvider {
  async extract(): Promise<TranscriptionResult> {
    const queued = fakeQueue().shift();
    if (queued instanceof Error) {
      throw queued;
    }
    return queued ?? { text: FAKE_ESSAY_TEXT, meanConfidence: 0.92 };
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
