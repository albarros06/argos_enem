import { describe, expect, it } from "vitest";
import { storage } from "@/lib/storage";
import { enqueueFakePdfResult, extractFromStorage, FAKE_ESSAY_TEXT } from "@/modules/transcription";

const PDF_KEY = "essays/test-user/unit-sample.pdf";

async function putFakePdf() {
  await storage().putObject(PDF_KEY, Buffer.from("pdf-fake"), "application/pdf");
}

describe("extractFromStorage — PDF routing", () => {
  it("rejects a multi-page PDF with reason multi_page_pdf (FR-011)", async () => {
    await putFakePdf();
    enqueueFakePdfResult({ text: FAKE_ESSAY_TEXT, meanConfidence: 0.9, totalPages: 2 });

    const outcome = await extractFromStorage(PDF_KEY);
    expect(outcome).toEqual({ ok: false, reason: "multi_page_pdf" });
  });

  it("maps a PDF extraction error to extraction_failed (FR-007)", async () => {
    await putFakePdf();
    enqueueFakePdfResult(new Error("pdf ilegível ou protegido"));

    const outcome = await extractFromStorage(PDF_KEY);
    expect(outcome).toEqual({ ok: false, reason: "extraction_failed" });
  });

  it("extracts text from a legible single-page PDF (FR-006/FR-013)", async () => {
    await putFakePdf();
    enqueueFakePdfResult({ text: FAKE_ESSAY_TEXT, meanConfidence: 0.9, totalPages: 1 });

    const outcome = await extractFromStorage(PDF_KEY);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.rawText).toBe(FAKE_ESSAY_TEXT);
      expect(outcome.meanConfidence).toBeGreaterThan(0.6);
    }
  });
});
