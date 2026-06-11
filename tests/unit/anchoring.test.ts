import { describe, expect, it } from "vitest";
import { anchorAnnotations } from "@/modules/grading/anchoring";
import type { LlmAnnotation } from "@/modules/grading/schema";

const text = "A educação transforma vidas. A educação é um direito de todos os brasileiros.";

function annotation(excerpt: string): LlmAnnotation {
  return { competency: 1, excerpt, issue: "problema", suggestion: "sugestão" };
}

describe("annotation anchoring", () => {
  it("computes offsets for excerpts found in the text", () => {
    const [anchored] = anchorAnnotations(text, [annotation("transforma vidas")]);
    expect(anchored.anchored).toBe(true);
    expect(anchored.startOffset).toBe(text.indexOf("transforma vidas"));
    expect(anchored.endOffset).toBe(anchored.startOffset! + "transforma vidas".length);
    expect(text.slice(anchored.startOffset!, anchored.endOffset!)).toBe("transforma vidas");
  });

  it("uses the first occurrence for duplicated excerpts", () => {
    const [anchored] = anchorAnnotations(text, [annotation("A educação")]);
    expect(anchored.startOffset).toBe(0);
  });

  it("flags unlocatable excerpts as anchored=false and keeps them", () => {
    const [unanchored] = anchorAnnotations(text, [annotation("trecho inexistente")]);
    expect(unanchored.anchored).toBe(false);
    expect(unanchored.startOffset).toBeNull();
    expect(unanchored.endOffset).toBeNull();
    expect(unanchored.issue).toBe("problema");
  });

  it("handles empty excerpt without anchoring", () => {
    const [unanchored] = anchorAnnotations(text, [annotation("")]);
    expect(unanchored.anchored).toBe(false);
  });
});
