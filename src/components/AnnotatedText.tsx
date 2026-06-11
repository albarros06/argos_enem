export interface AnnotationView {
  competency: number;
  excerpt: string;
  startOffset: number | null;
  endOffset: number | null;
  anchored: boolean;
  issue: string;
  suggestion: string;
}

interface Props {
  text: string;
  annotations: AnnotationView[];
}

// Destaca no texto confirmado os trechos ancorados por offset (R8); anotações
// sem âncora são listadas abaixo, sem destaque.
export function AnnotatedText({ text, annotations }: Props) {
  const anchored = annotations
    .filter(
      (annotation) =>
        annotation.anchored && annotation.startOffset !== null && annotation.endOffset !== null,
    )
    .sort((a, b) => a.startOffset! - b.startOffset!);

  const segments: React.ReactNode[] = [];
  let cursor = 0;
  anchored.forEach((annotation, index) => {
    const start = annotation.startOffset!;
    const end = annotation.endOffset!;
    if (start < cursor) {
      return; // trechos sobrepostos: mantém só o primeiro destaque
    }
    if (start > cursor) {
      segments.push(text.slice(cursor, start));
    }
    segments.push(
      <mark key={index} title={`C${annotation.competency}: ${annotation.issue}`}>
        {text.slice(start, end)}
        <sup>{index + 1}</sup>
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }

  const unanchored = annotations.filter((annotation) => !annotation.anchored);

  return (
    <div>
      <p style={{ whiteSpace: "pre-wrap" }}>{segments}</p>
      {anchored.length > 0 && (
        <ol>
          {anchored.map((annotation, index) => (
            <li key={index}>
              <strong>Competência {annotation.competency}:</strong> {annotation.issue}{" "}
              <span className="muted">Sugestão: {annotation.suggestion}</span>
            </li>
          ))}
        </ol>
      )}
      {unanchored.length > 0 && (
        <div className="card">
          <p className="muted">Outras observações (trecho não localizado no texto):</p>
          <ul>
            {unanchored.map((annotation, index) => (
              <li key={index}>
                <strong>Competência {annotation.competency}</strong> — “{annotation.excerpt}”:{" "}
                {annotation.issue} <span className="muted">Sugestão: {annotation.suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
