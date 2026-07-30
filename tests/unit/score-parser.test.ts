import { describe, expect, it } from "vitest";
import { parseScoreBlock } from "@/modules/grading/scoreParser";

const WELL_FORMED = `Alguma análise por competência...
ANNULLED: no
C1: 160
C2: 120
C3: 120
C4: 160
C5: 80`;

describe("parseScoreBlock (bloco de saída da CHAMADA 1)", () => {
  it("extrai as cinco notas de um bloco bem formado (não anulado)", () => {
    const result = parseScoreBlock(WELL_FORMED);
    expect(result.annulled).toBe(false);
    expect(result.scores).toEqual({ 1: 160, 2: 120, 3: 120, 4: 160, 5: 80 });
  });

  it("força todas as notas a 0 quando ANNULLED: yes, ignorando os valores lidos", () => {
    const result = parseScoreBlock(`ANNULLED: yes
C1: 160
C2: 200
C3: 120
C4: 160
C5: 200`);
    expect(result.annulled).toBe(true);
    expect(result.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  it("usa a ÚLTIMA ocorrência quando os rótulos aparecem no raciocínio", () => {
    const withProse = `Considerei dar C1: 80 no rascunho, e ANNULLED: yes seria exagero.
Bloco final:
ANNULLED: no
C1: 200
C2: 160
C3: 160
C4: 200
C5: 160`;
    const result = parseScoreBlock(withProse);
    expect(result.annulled).toBe(false);
    expect(result.scores[1]).toBe(200);
  });

  it("lança quando falta uma competência (C4 ausente)", () => {
    const missing = `ANNULLED: no
C1: 160
C2: 120
C3: 120
C5: 80`;
    expect(() => parseScoreBlock(missing)).toThrow(/C4/);
  });

  it("lança quando uma nota está fora do conjunto permitido", () => {
    const bad = `ANNULLED: no
C1: 160
C2: 100
C3: 120
C4: 160
C5: 80`;
    expect(() => parseScoreBlock(bad)).toThrow(/C2/);
  });

  it("lança quando não há linha ANNULLED", () => {
    expect(() => parseScoreBlock("C1: 160\nC2: 120\nC3: 120\nC4: 160\nC5: 80")).toThrow(
      /ANNULLED/,
    );
  });

  it("lança para resposta vazia/truncada (sem bloco)", () => {
    expect(() => parseScoreBlock("")).toThrow();
  });
});
