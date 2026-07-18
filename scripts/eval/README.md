# Avaliação da rubrica de correção (prompt tuning)

Mede a concordância do prompt de correção atual (`src/modules/grading/rubric.ts`)
com notas humanas do corpus **Essay-BR** (`~/projects/enem_db/essay-br/`), para
guiar o ajuste da rubrica com números em vez de intuição.

O corpus traz o texto **já digitado** (não passa por OCR), então isola a
qualidade de **correção** do OCR. As notas humanas vêm de uma plataforma de
ensino (não do INEP): há ruído de rótulo, então confie em **tendências e QWK**,
não em redações isoladas.

## Fluxo (loop de tuning)

```
build_sample.py   →  amostra estratificada dev/test (uma vez)
      │
run-eval.ts       →  corrige a amostra pelo caminho REAL de produção (caro)
      │
report.py         →  QWK / exato / ±1 / MAE / viés por competência
      │
(editar rubric.ts, bump RUBRIC_VERSION) → re-rodar run-eval + report no DEV
      │
validar no TEST só no final (evita overfit do prompt ao dev)
```

## 1. Construir a amostra (uma vez)

```bash
python3 scripts/eval/build_sample.py \
  --corpus ~/projects/enem_db/essay-br/essay-br.csv \
  --prompts ~/projects/enem_db/essay-br/prompts.csv \
  --dev 500 --test 500 --seed 42
```

Estratifica por faixa de nota total (0-200, …, 800-1000) para que dev e test
espelhem a distribuição do corpus. Gera `data/dev.jsonl` e `data/test.jsonl`
(disjuntos). Requer só `pandas`/`numpy`.

## 2. Rodar a correção (passo caro — 1 chamada de LLM por redação)

```bash
CONCURRENCY=6 npx tsx scripts/eval/run-eval.ts scripts/eval/data/dev.jsonl
```

- Usa `gradingProvider().grade()` — o **mesmo** caminho da produção, com o
  `GRADING_MODEL_ID` e a rubrica atuais (temperatura 0).
- Carrega `.env` sozinho (via `process.loadEnvFile`) e usa a região `global`
  por padrão — onde `gemini-3.1-pro-preview` é servido. Sobrescreva com
  `GOOGLE_CLOUD_LOCATION=... ` ou `GRADING_MODEL_ID=...` no shell.
- **Retomável**: reexecute o mesmo comando para completar/tentar de novo as que
  falharam. Saída: `results/<split>--<model>.jsonl`.

Para comparar dois modelos/versões de rubrica, rode com `GRADING_MODEL_ID`
diferente (gera arquivos de saída distintos).

## 3. Relatório

```bash
python3 scripts/eval/report.py \
  results/dev--gemini-3.1-pro-preview.jsonl \
  --md results/report-dev-baseline.md
```

Métricas por competência (níveis ordinais 0/40/…/200):

| métrica | leitura |
|---------|---------|
| **QWK** | Quadratic Weighted Kappa — métrica padrão de AES. >0.6 bom, >0.8 ótimo. |
| exato%  | % com a nota exata do humano. |
| ±1 nível% | % dentro de ±40 pts (tolerância usual entre corretores). |
| MAE     | erro absoluto médio em pontos. |
| **viés** | média(previsto) − média(humano). **+** = generoso, **−** = severo. É o sinal mais acionável para editar a rubrica. |

Também: MAE/QWK/correlação da nota total e matriz de confusão por competência
(revela padrões, ex.: o modelo nunca dá 200 em C5).

## Como usar para ajustar o prompt

1. Rode o baseline no **dev** e leia o **viés** por competência.
2. Um viés grande e consistente aponta o descritor a mexer em `rubric.ts`
   (ex.: viés +30 em C5 → o modelo é generoso demais; aperte o critério dos
   5 elementos da proposta de intervenção).
3. Edite `rubric.ts`, **suba `RUBRIC_VERSION`**, re-rode dev, compare QWK/viés.
4. Só quando o dev estabilizar, valide no **test** — se test e dev discordarem
   muito, o prompt superajustou ao dev.

> Rótulos do Essay-BR ≠ INEP. A meta é **reduzir viés e subir QWK**, não bater
> 100% de exato — corretores humanos entre si também não batem.
