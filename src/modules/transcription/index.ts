import { business } from "@/lib/config";
import { logger } from "@/lib/logger";
import { storage } from "@/lib/storage";
import { countEssayLines } from "@/lib/text";
import { transcriptionProvider } from "./provider";

export { enqueueFakeTranscriptionResult, FAKE_ESSAY_TEXT } from "./provider";

export type ExtractionOutcome =
  | { ok: true; rawText: string; meanConfidence: number }
  | { ok: false; reason: "extraction_failed" | "insufficient_text" };

// Extrai o texto da imagem no storage e aplica os limiares de qualidade (FR-006/FR-007).
// Falha NÃO consome crédito — o chamador apenas marca a submissão como failed.
export async function extractFromStorage(imageKey: string): Promise<ExtractionOutcome> {
  let text: string;
  let meanConfidence: number;
  try {
    const image = await storage().getObject(imageKey);
    const result = await logger.vendorCall("google-vision", "documentTextDetection", () =>
      transcriptionProvider().extract(image),
    );
    text = result.text;
    meanConfidence = result.meanConfidence;
  } catch (error) {
    logger.error("extraction_error", {
      imageKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "extraction_failed" };
  }

  if (!text.trim() || meanConfidence < business.ocrMinMeanConfidence) {
    return { ok: false, reason: "extraction_failed" };
  }
  if (countEssayLines(text) < business.minEssayLines) {
    return { ok: false, reason: "insufficient_text" };
  }
  return { ok: true, rawText: text, meanConfidence };
}
