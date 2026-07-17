import fs from "fs";
import { business } from "../src/lib/config";
import { gradingProvider } from "../src/modules/grading/llm";

// Corrige uma redação com o GRADING_MODEL_ID atual e imprime as notas por
// competência + validade do JSON. Rode duas vezes (2.5 vs 3.1) e compare as
// notas antes de confiar na migração de grading — a estabilidade de nota importa.
//
// Requer credenciais reais no ambiente:
//   set -a; source .env; set +a
//   GRADING_MODEL_ID=gemini-2.5-pro     npx tsx scripts/grade-essay.ts redacao.json > 2.5.json
//   GRADING_MODEL_ID=gemini-3.1-pro-preview npx tsx scripts/grade-essay.ts redacao.json > 3.1.json
//   diff <(jq .competencies 2.5.json) <(jq .competencies 3.1.json)
//
// redacao.json: { "theme": "…", "essayText": "…" }
async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Uso: npx tsx scripts/grade-essay.ts <redacao.json>");
    process.exit(1);
  }
  const { theme, essayText } = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!theme || !essayText) {
    console.error("O JSON precisa ter os campos 'theme' e 'essayText'.");
    process.exit(1);
  }

  const started = Date.now();
  const evaluation = await gradingProvider().grade({ theme, essayText });
  const ms = Date.now() - started;

  const total = evaluation.competencies.reduce((sum, c) => sum + c.score, 0);
  console.error(`modelo=${business.gradingModelId} tempo=${ms}ms total=${total} zeroReason=${evaluation.zeroReason ?? "none"}`);
  console.log(JSON.stringify(evaluation, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
