import type { CompetencyNumber, Score, ScoringResult } from "./schema";

// Parser do bloco de saída da CHAMADA 1 (prompt v5_calibrated). O modelo raciocina em
// texto livre e TERMINA com um bloco:
//
//   ANNULLED: <yes|no>
//   C1: <0|40|80|120|160|200>
//   ... C2..C5
//
// Só o bloco é consumido (nunca o raciocínio). Ver contracts/scoring-call.md.

const ALLOWED_SCORES = new Set<number>([0, 40, 80, 120, 160, 200]);
const COMPETENCIES: CompetencyNumber[] = [1, 2, 3, 4, 5];

// Última ocorrência de um rótulo — o bloco fica no FIM da resposta, depois de um
// raciocínio que pode repetir os rótulos ("C1", "ANNULLED") no meio do texto.
function lastMatch(text: string, pattern: RegExp): string | null {
  const matches = [...text.matchAll(pattern)];
  return matches.length ? matches[matches.length - 1][1] : null;
}

export function parseScoreBlock(text: string): ScoringResult {
  const annulledRaw = lastMatch(text, /ANNULLED:\s*(yes|no)\b/gi);
  if (annulledRaw === null) {
    throw new Error("Saída da pontuação sem linha ANNULLED: <yes|no>");
  }
  const annulled = annulledRaw.toLowerCase() === "yes";

  const scores = {} as Record<CompetencyNumber, Score>;
  for (const c of COMPETENCIES) {
    const raw = lastMatch(text, new RegExp(`C${c}:\\s*(\\d+)`, "gi"));
    if (raw === null) {
      throw new Error(`Saída da pontuação sem a linha C${c}`);
    }
    const value = Number(raw);
    if (!ALLOWED_SCORES.has(value)) {
      throw new Error(`Nota inválida em C${c}: ${raw} (fora de {0,40,80,120,160,200})`);
    }
    // Anulação zera tudo independentemente dos valores lidos (contrato FR-004).
    scores[c] = (annulled ? 0 : value) as Score;
  }

  return { annulled, scores };
}
