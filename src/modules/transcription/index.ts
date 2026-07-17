import { business } from "@/lib/config";
import { logger } from "@/lib/logger";
import { storage } from "@/lib/storage";
import { countEssayLines } from "@/lib/text";
import { imageTranscriptionProvider, pdfTranscriptionProvider } from "./provider";

export { enqueueFakeTranscriptionResult, enqueueFakePdfResult, FAKE_ESSAY_TEXT } from "./provider";

export type ExtractionOutcome =
  | { ok: true; rawText: string; meanConfidence: number }
  | { ok: false; reason: "extraction_failed" | "insufficient_text" | "multi_page_pdf" };

// Extrai o texto do arquivo no storage e aplica os limiares de qualidade (FR-006/FR-007).
// Roteia pelo sufixo da chave: .pdf -> Vision (batchAnnotateFiles, com totalPages para a
// rejeição de multipágina, FR-011); imagem -> provider de imagem selecionado por config
// (Gemini/LLM ou Vision). Falha NÃO consome crédito — o chamador marca a submissão failed.
export async function extractFromStorage(imageKey: string): Promise<ExtractionOutcome> {
  const isPdf = imageKey.toLowerCase().endsWith(".pdf");
  let text: string;
  let meanConfidence: number;
  try {
    const file = await storage().getObject(imageKey);
    if (isPdf) {
      const result = await logger.vendorCall("google-vision", "batchAnnotateFiles", () =>
        pdfTranscriptionProvider().extractPdf(file),
      );
      // Redação do ENEM é uma única página: mais de uma página é rejeitada (FR-011).
      if (result.totalPages > 1) {
        return { ok: false, reason: "multi_page_pdf" };
      }
      text = result.text;
      meanConfidence = result.meanConfidence;
    } else {
      const mimeType = imageKey.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
      const result = await logger.vendorCall("image-ocr", "transcribe", () =>
        imageTranscriptionProvider().extract(file, mimeType),
      );
      text = result.text;
      meanConfidence = result.meanConfidence;
    }
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
