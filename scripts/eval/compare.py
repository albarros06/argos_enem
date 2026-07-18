#!/usr/bin/env python3
"""
Compara dois arquivos de previsões (baseline vs. rubrica editada) nas MESMAS
redações — o artefato de decisão do loop de tuning. Mostra, por competência,
viés e QWK de cada versão e o delta, para responder: "o viés de C5 melhorou?
alguma competência regrediu?".

Só considera ids presentes nos DOIS arquivos e bem-sucedidos em ambos, para uma
comparação pareada justa (temp 0 -> a diferença é o efeito do prompt, não ruído).

Uso:
    python3 scripts/eval/compare.py \
        results/dev-mini--MODEL--v1.0.0.jsonl \
        results/dev-mini--MODEL--c5-fix.jsonl
"""
import argparse
import json
from pathlib import Path

import numpy as np

LEVELS = [0, 40, 80, 120, 160, 200]
LEVEL_INDEX = {v: i for i, v in enumerate(LEVELS)}
COMPS = ["c1", "c2", "c3", "c4", "c5"]


def to_level(score: int) -> int:
    return LEVEL_INDEX.get(int(score), int(round(int(score) / 40)))


def qwk(human, pred, n=len(LEVELS)) -> float:
    h, p = np.asarray(human, int), np.asarray(pred, int)
    if len(h) == 0:
        return float("nan")
    O = np.zeros((n, n))
    for a, b in zip(h, p):
        O[a, b] += 1
    w = np.fromfunction(lambda i, j: (i - j) ** 2 / (n - 1) ** 2, (n, n))
    E = np.outer(O.sum(1), O.sum(0)) / O.sum()
    d = (w * E).sum()
    return float("nan") if d == 0 else 1.0 - (w * O).sum() / d


def load_ok(path: str) -> dict[str, dict]:
    by_id: dict[str, dict] = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        prev = by_id.get(r["id"])
        if prev is None or (r.get("ok") and not prev.get("ok")):
            by_id[r["id"]] = r
    return {i: r for i, r in by_id.items() if r.get("ok") and r.get("pred")}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("baseline")
    ap.add_argument("variant")
    args = ap.parse_args()

    a, b = load_ok(args.baseline), load_ok(args.variant)
    ids = sorted(set(a) & set(b))
    if not ids:
        raise SystemExit("nenhum id em comum entre os dois arquivos.")

    print(f"# Comparação (n={len(ids)} redações pareadas)\n")
    print(f"- baseline: `{args.baseline}`")
    print(f"- variante: `{args.variant}`\n")
    print("| Comp | viés base | viés var | Δ viés | QWK base | QWK var | Δ QWK | exato base→var |")
    print("|------|-----------|----------|--------|----------|---------|-------|----------------|")

    for comp in COMPS:
        hb = [a[i]["human"][comp] for i in ids]
        pb = [a[i]["pred"][comp] for i in ids]
        pv = [b[i]["pred"][comp] for i in ids]
        bias_b = np.mean(np.array(pb) - np.array(hb))
        bias_v = np.mean(np.array(pv) - np.array(hb))
        qb = qwk([to_level(x) for x in hb], [to_level(x) for x in pb])
        qv = qwk([to_level(x) for x in hb], [to_level(x) for x in pv])
        ex_b = np.mean([to_level(x) == to_level(y) for x, y in zip(hb, pb)]) * 100
        ex_v = np.mean([to_level(x) == to_level(y) for x, y in zip(hb, pv)]) * 100
        # |viés| menor e QWK maior = melhor. Marca melhora/piora clara.
        mark = "✓" if abs(bias_v) < abs(bias_b) - 1 and qv >= qb - 0.02 else (
            "✗" if abs(bias_v) > abs(bias_b) + 1 or qv < qb - 0.05 else "·"
        )
        print(
            f"| {comp.upper()} {mark} | {bias_b:+.1f} | {bias_v:+.1f} | {bias_v - bias_b:+.1f} | "
            f"{qb:.3f} | {qv:.3f} | {qv - qb:+.3f} | {ex_b:.0f}%→{ex_v:.0f}% |"
        )

    # Nota total.
    hb = np.array([a[i]["human"]["total"] for i in ids], float)
    tb = np.array([a[i]["pred"]["total"] for i in ids], float)
    tv = np.array([b[i]["pred"]["total"] for i in ids], float)
    print(
        f"\nNota total — viés {tb.mean()-hb.mean():+.1f} → {tv.mean()-hb.mean():+.1f} pts | "
        f"MAE {np.abs(tb-hb).mean():.1f} → {np.abs(tv-hb).mean():.1f} pts"
    )
    print("\n(✓ = viés menor sem regressão de QWK; ✗ = regressão; · = neutro)")


if __name__ == "__main__":
    main()
