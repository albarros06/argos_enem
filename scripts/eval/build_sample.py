#!/usr/bin/env python3
"""
Constrói amostras estratificadas de dev/test a partir do corpus Essay-BR para
avaliar a rubrica de correção (RUBRIC_SYSTEM_PROMPT) contra notas humanas.

O corpus (essay-br.csv) traz `essay` e `competence` como literais de lista Python
(ex.: "['par1', 'par2']", "[120, 80, ...]"), então usamos ast.literal_eval —
json.loads falharia por causa das aspas simples e apóstrofos do português.

Estratificamos por faixa de nota total (0-200, 200-400, ...) para que dev e test
tenham a mesma distribuição de qualidade do corpus — caso contrário QWK e viés
ficam enviesados pela faixa dominante (a maioria das redações fica em 400-700).

Uso:
    python3 scripts/eval/build_sample.py \
        --corpus ~/projects/enem_db/essay-br/essay-br.csv \
        --prompts ~/projects/enem_db/essay-br/prompts.csv \
        --dev 500 --test 500 --seed 42

Saídas: scripts/eval/data/dev.jsonl e scripts/eval/data/test.jsonl
Cada linha: {id, theme, title, essayText, human:{c1..c5,total}}
"""
import argparse
import ast
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"

# Faixas de nota total do ENEM (0-1000) para estratificação.
BANDS = [(0, 200), (200, 400), (400, 600), (600, 800), (800, 1001)]


def band_of(total: int) -> int:
    for i, (lo, hi) in enumerate(BANDS):
        if lo <= total < hi:
            return i
    return len(BANDS) - 1


def load_prompts(path: str) -> dict[int, str]:
    """id -> texto motivador completo (concatenado). Ausência é tolerada."""
    if not path or not os.path.exists(path):
        return {}
    df = pd.read_csv(path, converters={"description": _safe_literal_list})
    out: dict[int, str] = {}
    for _, row in df.iterrows():
        desc = row["description"]
        if isinstance(desc, list):
            out[int(row["id"])] = "\n\n".join(str(p).strip() for p in desc)
        elif isinstance(desc, str):
            out[int(row["id"])] = desc.strip()
    return out


def _safe_literal_list(value):
    try:
        return ast.literal_eval(value)
    except (ValueError, SyntaxError):
        return value


def build_theme(title: str, prompt_id, prompts: dict[int, str]) -> str:
    """
    Tema passado ao corretor = enunciado curto + textos motivadores, espelhando o
    themeText que a produção envia (um enunciado ENEM completo, não só o título).
    Sem o texto motivador o modelo não consegue julgar tangenciamento/cópia (C2/C3).
    """
    motivating = ""
    try:
        motivating = prompts.get(int(prompt_id), "")
    except (TypeError, ValueError):
        motivating = ""
    if motivating:
        return f"{title.strip()}\n\nTextos motivadores:\n{motivating}"
    return title.strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", required=True, help="caminho para essay-br.csv")
    ap.add_argument("--prompts", default="", help="caminho para prompts.csv (opcional)")
    ap.add_argument("--dev", type=int, default=500)
    ap.add_argument("--test", type=int, default=500)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    df = pd.read_csv(
        args.corpus,
        converters={"essay": _safe_literal_list, "competence": _safe_literal_list},
    )
    prompts = load_prompts(args.prompts)

    # Normaliza e descarta linhas malformadas (competências != 5, essay vazio).
    records = []
    for _, row in df.iterrows():
        comp = row["competence"]
        essay = row["essay"]
        if not isinstance(comp, list) or len(comp) != 5:
            continue
        if not isinstance(essay, list) or not essay:
            continue
        essay_text = "\n\n".join(str(p).strip() for p in essay).strip()
        if not essay_text:
            continue
        total = int(sum(int(c) for c in comp))
        records.append(
            {
                "title": str(row.get("title", "")).strip(),
                "prompt_id": row.get("prompt", ""),
                "essayText": essay_text,
                "c": [int(c) for c in comp],
                "total": total,
            }
        )

    n = len(records)
    print(f"corpus válido: {n} redações")

    rng = np.random.default_rng(args.seed)
    want_total = args.dev + args.test
    if want_total > n:
        raise SystemExit(f"pedido {want_total} > disponível {n}")

    # Agrupa índices por faixa, embaralha, aloca proporcionalmente a dev+test.
    by_band: dict[int, list[int]] = {}
    for i, r in enumerate(records):
        by_band.setdefault(band_of(r["total"]), []).append(i)

    dev_idx: list[int] = []
    test_idx: list[int] = []
    for band, idxs in sorted(by_band.items()):
        idxs = list(idxs)
        rng.shuffle(idxs)
        take = round(want_total * len(idxs) / n)
        take = min(take, len(idxs))
        chosen = idxs[:take]
        # Metade para dev, metade para test (disjuntos), mantendo a faixa.
        split = round(len(chosen) * args.dev / want_total)
        dev_idx.extend(chosen[:split])
        test_idx.extend(chosen[split:])
        lo, hi = BANDS[band]
        print(f"  faixa {lo}-{hi}: {len(idxs)} corpus -> {split} dev / {len(chosen) - split} test")

    # Ajuste fino: arredondamentos podem desviar alguns itens do alvo.
    rng.shuffle(dev_idx)
    rng.shuffle(test_idx)
    dev_idx = dev_idx[: args.dev]
    test_idx = test_idx[: args.test]

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _write_split(DATA_DIR / "dev.jsonl", records, dev_idx, prompts)
    _write_split(DATA_DIR / "test.jsonl", records, test_idx, prompts)
    print(f"\nescrito: {len(dev_idx)} dev, {len(test_idx)} test em {DATA_DIR}")


def _write_split(path: Path, records: list[dict], idxs: list[int], prompts: dict[int, str]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for i in idxs:
            r = records[i]
            c = r["c"]
            obj = {
                "id": f"essaybr-{i}",
                "title": r["title"],
                "theme": build_theme(r["title"], r["prompt_id"], prompts),
                "essayText": r["essayText"],
                "human": {
                    "c1": c[0], "c2": c[1], "c3": c[2], "c4": c[3], "c5": c[4],
                    "total": r["total"],
                },
            }
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
