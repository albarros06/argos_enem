#!/usr/bin/env python3
"""
Lê um arquivo de previsões (scripts/eval/results/*.jsonl produzido por run-eval.ts)
e mede a concordância da rubrica atual com as notas humanas do Essay-BR.

Métricas por competência (0-200 em passos de 40, tratadas como 6 níveis ordinais):
- QWK  : Quadratic Weighted Kappa — métrica padrão de correção automática (AES).
         0 = azar; 1 = concordância perfeita; penaliza mais os erros distantes.
- exato: % em que a nota prevista == nota humana.
- ±1   : % dentro de um nível (±40 pontos) — tolerância usual entre corretores.
- MAE  : erro absoluto médio em PONTOS.
- viés : média(previsto) - média(humano). Positivo = generoso; negativo = severo.
         É o sinal mais acionável para editar rubric.ts (ex.: C5 sistematicamente +).

Também: MAE/QWK da nota total e matriz de confusão por competência.

Uso:
    python3 scripts/eval/report.py scripts/eval/results/dev--gemini-3.1-pro-preview.jsonl
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

LEVELS = [0, 40, 80, 120, 160, 200]
LEVEL_INDEX = {v: i for i, v in enumerate(LEVELS)}
COMPS = ["c1", "c2", "c3", "c4", "c5"]


def to_level(score: int) -> int:
    """Nota (0..200 passo 40) -> índice ordinal 0..5. Arredonda fora de grade."""
    return LEVEL_INDEX.get(int(score), int(round(int(score) / 40)))


def qwk(human: list[int], pred: list[int], n_levels: int) -> float:
    """Quadratic Weighted Kappa entre dois vetores de índices ordinais 0..n-1."""
    h = np.asarray(human, dtype=int)
    p = np.asarray(pred, dtype=int)
    if len(h) == 0:
        return float("nan")
    O = np.zeros((n_levels, n_levels), dtype=float)
    for a, b in zip(h, p):
        O[a, b] += 1
    w = np.zeros((n_levels, n_levels), dtype=float)
    denom = (n_levels - 1) ** 2
    for i in range(n_levels):
        for j in range(n_levels):
            w[i, j] = (i - j) ** 2 / denom
    hist_h = O.sum(axis=1)
    hist_p = O.sum(axis=0)
    E = np.outer(hist_h, hist_p) / O.sum()
    denom_e = (w * E).sum()
    if denom_e == 0:
        return float("nan")
    return 1.0 - (w * O).sum() / denom_e


def fmt(x: float) -> str:
    return "n/a" if x != x else f"{x:.3f}"  # x!=x => NaN


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("results", help="arquivo de previsões *.jsonl")
    ap.add_argument("--md", default="", help="grava relatório markdown neste caminho")
    args = ap.parse_args()

    raw = [json.loads(l) for l in Path(args.results).read_text(encoding="utf-8").splitlines() if l.strip()]
    # Retomadas anexam novas tentativas: deduplica por id, preferindo o sucesso.
    by_id: dict[str, dict] = {}
    for r in raw:
        prev = by_id.get(r["id"])
        if prev is None or (r.get("ok") and not prev.get("ok")):
            by_id[r["id"]] = r
    rows = list(by_id.values())
    ok = [r for r in rows if r.get("ok") and r.get("pred")]
    failed = [r for r in rows if not r.get("ok")]

    if not ok:
        sys.exit("nenhuma previsão bem-sucedida no arquivo.")

    lines: list[str] = []

    def out(s: str = "") -> None:
        print(s)
        lines.append(s)

    out(f"# Relatório de avaliação da rubrica")
    out()
    out(f"- arquivo: `{args.results}`")
    out(f"- redações avaliadas: **{len(ok)}** (falhas: {len(failed)})")
    out()

    # --- Por competência --------------------------------------------------
    out("## Concordância por competência")
    out()
    out("| Comp | QWK | exato% | ±1 nível% | MAE (pts) | viés (pts) | média hum | média prev |")
    out("|------|-----|--------|-----------|-----------|------------|-----------|------------|")
    qwks = []
    for comp in COMPS:
        h_pts = np.array([r["human"][comp] for r in ok], dtype=float)
        p_pts = np.array([r["pred"][comp] for r in ok], dtype=float)
        h_lvl = [to_level(r["human"][comp]) for r in ok]
        p_lvl = [to_level(r["pred"][comp]) for r in ok]
        k = qwk(h_lvl, p_lvl, len(LEVELS))
        qwks.append(k)
        exact = np.mean([a == b for a, b in zip(h_lvl, p_lvl)]) * 100
        adj = np.mean([abs(a - b) <= 1 for a, b in zip(h_lvl, p_lvl)]) * 100
        mae = np.mean(np.abs(h_pts - p_pts))
        bias = np.mean(p_pts - h_pts)
        out(
            f"| {comp.upper()} | {fmt(k)} | {exact:.1f} | {adj:.1f} | {mae:.1f} | "
            f"{bias:+.1f} | {h_pts.mean():.0f} | {p_pts.mean():.0f} |"
        )
    out(f"| **média** | **{fmt(float(np.nanmean(qwks)))}** | | | | | | |")
    out()

    # --- Nota total -------------------------------------------------------
    ht = np.array([r["human"]["total"] for r in ok], dtype=float)
    pt = np.array([r["pred"]["total"] for r in ok], dtype=float)
    total_mae = np.mean(np.abs(ht - pt))
    total_bias = np.mean(pt - ht)
    # QWK da total: níveis por faixa de 100 (0..1000 -> 11 faixas).
    ht_band = [min(int(round(x / 100)), 10) for x in ht]
    pt_band = [min(int(round(x / 100)), 10) for x in pt]
    total_qwk = qwk(ht_band, pt_band, 11)
    corr = (
        np.corrcoef(ht, pt)[0, 1]
        if len(ht) > 1 and ht.std() > 0 and pt.std() > 0
        else float("nan")
    )
    out("## Nota total (0–1000)")
    out()
    out(f"- MAE: **{total_mae:.1f} pts**")
    out(f"- viés: **{total_bias:+.1f} pts** (positivo = corretor generoso vs humano)")
    out(f"- QWK (faixas de 100): **{fmt(total_qwk)}**")
    out(f"- correlação de Pearson: **{fmt(corr)}**")
    out(f"- dentro de ±80 pts: **{np.mean(np.abs(ht - pt) <= 80) * 100:.1f}%**")
    out(f"- dentro de ±160 pts: **{np.mean(np.abs(ht - pt) <= 160) * 100:.1f}%**")
    out()

    # --- zeroReason -------------------------------------------------------
    zeros = [r for r in ok if r["pred"].get("zeroReason")]
    if zeros:
        from collections import Counter
        counts = Counter(r["pred"]["zeroReason"] for r in zeros)
        out("## Notas zero previstas")
        out()
        for reason, c in counts.most_common():
            # Quantas dessas o humano também zerou?
            human_also_zero = sum(
                1 for r in zeros if r["pred"]["zeroReason"] == reason and r["human"]["total"] == 0
            )
            out(f"- `{reason}`: {c} (humano também zerou: {human_also_zero})")
        out()

    # --- Matriz de confusão por competência -------------------------------
    out("## Matrizes de confusão (linhas = humano, colunas = previsto; níveis 0–200)")
    for comp in COMPS:
        M = np.zeros((len(LEVELS), len(LEVELS)), dtype=int)
        for r in ok:
            M[to_level(r["human"][comp]), to_level(r["pred"][comp])] += 1
        out()
        out(f"### {comp.upper()}")
        out()
        header = "| hum\\prev | " + " | ".join(str(v) for v in LEVELS) + " |"
        out(header)
        out("|" + "---|" * (len(LEVELS) + 1))
        for i, v in enumerate(LEVELS):
            row = " | ".join(str(M[i, j]) for j in range(len(LEVELS)))
            out(f"| **{v}** | {row} |")
    out()

    if failed:
        out("## Falhas")
        out()
        from collections import Counter
        errs = Counter((r.get("error") or "")[:80] for r in failed)
        for err, c in errs.most_common(10):
            out(f"- ({c}) {err}")

    if args.md:
        Path(args.md).write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"\n[markdown escrito em {args.md}]", file=sys.stderr)


if __name__ == "__main__":
    main()
