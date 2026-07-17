import { describe, expect, it } from "vitest";
import { imageOcrKind } from "@/modules/transcription/provider";

describe("imageOcrKind (seleção do OCR de imagem)", () => {
  it("usa o fake quando FAKE_VENDORS está ligado, ignorando o modelo", () => {
    expect(imageOcrKind(true, "gemini-3-flash-preview")).toBe("fake");
    expect(imageOcrKind(true, "google-vision")).toBe("fake");
  });

  it("roteia modelos gemini-* para a transcrição por LLM", () => {
    expect(imageOcrKind(false, "gemini-3-flash-preview")).toBe("gemini");
    expect(imageOcrKind(false, "gemini-2.5-flash")).toBe("gemini");
  });

  it("mantém o Vision para qualquer outro valor (revert por env)", () => {
    expect(imageOcrKind(false, "google-vision")).toBe("vision");
    expect(imageOcrKind(false, "vision")).toBe("vision");
  });
});
