import type { LlmAnnotation } from "./schema";

export interface AnchoredAnnotation extends LlmAnnotation {
  startOffset: number | null;
  endOffset: number | null;
  anchored: boolean;
}

// Localiza cada excerpt literal no texto confirmado (primeira ocorrência — R8).
// Excerpts não encontrados são mantidos com anchored=false e exibidos sem destaque.
export function anchorAnnotations(
  confirmedText: string,
  annotations: LlmAnnotation[],
): AnchoredAnnotation[] {
  return annotations.map((annotation) => {
    const start = annotation.excerpt ? confirmedText.indexOf(annotation.excerpt) : -1;
    if (start === -1) {
      return { ...annotation, startOffset: null, endOffset: null, anchored: false };
    }
    return {
      ...annotation,
      startOffset: start,
      endOffset: start + annotation.excerpt.length,
      anchored: true,
    };
  });
}
