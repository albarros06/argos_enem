import fs from "fs";
import path from "path";

// Carrega .env ANTES de importar config/llm (que validam o ambiente no import).
// process.loadEnvFile (Node 20.12+) usa o mesmo parser do dotenv — lida com o
// GOOGLE_APPLICATION_CREDENTIALS_JSON multilinha entre aspas, que o `source` do
// bash não consegue ler. Variáveis já presentes no ambiente têm precedência.
const ENV_FILE = process.env.ENV_FILE ?? path.join(__dirname, "../../.env");
if (fs.existsSync(ENV_FILE)) {
  const before = { ...process.env };
  process.loadEnvFile(ENV_FILE);
  for (const [k, v] of Object.entries(before)) {
    if (v !== undefined) process.env[k] = v; // restaura overrides do shell
  }
  // gemini-3.1-pro-preview é servido na região `global`, não em us-central1.
  // Default para a avaliação; o shell ainda pode sobrescrever explicitamente.
  if (before.GOOGLE_CLOUD_LOCATION === undefined) {
    process.env.GOOGLE_CLOUD_LOCATION = "global";
  }
}

const { business } = require("../../src/lib/config") as typeof import("../../src/lib/config");
const { gradingProvider } =
  require("../../src/modules/grading/llm") as typeof import("../../src/modules/grading/llm");
const { RUBRIC_VERSION } =
  require("../../src/modules/grading/rubric") as typeof import("../../src/modules/grading/rubric");

// Roda um split (dev.jsonl / test.jsonl) pelo MESMO caminho de correção da
// produção — gradingProvider().grade() com o GRADING_MODEL_ID e a rubrica atuais
// — e grava as notas previstas ao lado das notas humanas. É o passo caro do loop
// de tuning: cada redação = uma chamada de LLM. Suporta retomada (resume) e
// concorrência limitada para não estourar limites de taxa do Vertex/Anthropic.
//
// Loop de tuning (barato): itere no subconjunto pequeno com um RUN_TAG por
// variante de prompt; só rode o dev/test completos nos checkpoints.
//   npx tsx scripts/eval/run-eval.ts scripts/eval/data/dev.jsonl            # baseline
//   RUN_TAG=c5-fix npx tsx scripts/eval/run-eval.ts scripts/eval/data/dev-mini.jsonl
//
// Saída: scripts/eval/results/<split>--<model>--<tag>.jsonl (tag = RUN_TAG ou
// vRUBRIC_VERSION). Retomável — reexecute o mesmo comando para completar/tentar
// de novo as que falharam. Requer credenciais reais (carrega .env sozinho).
// CONCURRENCY (3) e MAX_RETRIES (5) ajustáveis por env.

interface SampleRecord {
  id: string;
  title: string;
  theme: string;
  essayText: string;
  human: { c1: number; c2: number; c3: number; c4: number; c5: number; total: number };
}

interface ResultRecord {
  id: string;
  ok: boolean;
  ms: number;
  human: SampleRecord["human"];
  pred?: {
    c1: number; c2: number; c3: number; c4: number; c5: number;
    total: number;
    zeroReason: string | null;
  };
  error?: string;
}

function readJsonl<T>(file: string): T[] {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Uso: npx tsx scripts/eval/run-eval.ts <split.jsonl>");
    process.exit(1);
  }
  const concurrency = Math.max(1, Number(process.env.CONCURRENCY ?? "3"));
  const maxRetries = Math.max(0, Number(process.env.MAX_RETRIES ?? "5"));

  const samples = readJsonl<SampleRecord>(inputPath);
  const split = path.basename(inputPath).replace(/\.jsonl$/, "");
  const modelSlug = business.gradingModelId.replace(/[^a-zA-Z0-9.-]/g, "_");
  // RUN_TAG separa versões de prompt no MESMO modelo — sem ele, um segundo run
  // com rubrica editada sobrescreveria o baseline. Default = versão da rubrica.
  const tag = (process.env.RUN_TAG ?? `v${RUBRIC_VERSION}`).replace(/[^a-zA-Z0-9.-]/g, "_");
  const outDir = path.join(__dirname, "results");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${split}--${modelSlug}--${tag}.jsonl`);

  // Retomada: pula ids já gravados com sucesso; reprocessa falhas.
  const doneOk = new Set<string>();
  if (fs.existsSync(outPath)) {
    for (const r of readJsonl<ResultRecord>(outPath)) {
      if (r.ok) doneOk.add(r.id);
    }
  }
  const todo = samples.filter((s) => !doneOk.has(s.id));
  console.error(
    `modelo=${business.gradingModelId} split=${split} total=${samples.length} ` +
      `feitas=${doneOk.size} restantes=${todo.length} concorrencia=${concurrency}`,
  );
  if (todo.length === 0) {
    console.error("nada a fazer — todas as redações já foram corrigidas.");
    return;
  }

  const out = fs.createWriteStream(outPath, { flags: "a" });
  const write = (r: ResultRecord) =>
    new Promise<void>((res) => out.write(JSON.stringify(r) + "\n", () => res()));

  const provider = gradingProvider();
  let idx = 0;
  let completed = 0;
  let failures = 0;
  let retries = 0;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const isRateLimit = (e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    return /RESOURCE_EXHAUSTED|429|\b503\b|UNAVAILABLE|overloaded/i.test(m);
  };

  // Backoff exponencial com jitter para 429/503 do Vertex (quota do preview é
  // baixa). Só reeleva erros não-transitórios ou quando esgota as tentativas.
  async function gradeWithRetry(sample: SampleRecord) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await provider.grade({ theme: sample.theme, essayText: sample.essayText });
      } catch (error) {
        if (attempt >= maxRetries || !isRateLimit(error)) throw error;
        retries++;
        const backoff = Math.min(60000, 4000 * 2 ** attempt) + Math.floor(Math.random() * 1000);
        await sleep(backoff);
      }
    }
  }

  async function worker() {
    while (idx < todo.length) {
      const sample = todo[idx++];
      const started = Date.now();
      try {
        const evaluation = await gradeWithRetry(sample);
        const s = new Map(evaluation.competencies.map((c) => [c.competency, c.score]));
        const total = evaluation.competencies.reduce((sum, c) => sum + c.score, 0);
        await write({
          id: sample.id,
          ok: true,
          ms: Date.now() - started,
          human: sample.human,
          pred: {
            c1: s.get(1)!, c2: s.get(2)!, c3: s.get(3)!, c4: s.get(4)!, c5: s.get(5)!,
            total,
            zeroReason: evaluation.zeroReason,
          },
        });
      } catch (error) {
        failures++;
        await write({
          id: sample.id,
          ok: false,
          ms: Date.now() - started,
          human: sample.human,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      completed++;
      if (completed % 25 === 0 || completed === todo.length) {
        console.error(`  ${completed}/${todo.length} (falhas=${failures} retries=${retries})`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  await new Promise<void>((res) => out.end(res));
  console.error(`\nconcluído: ${completed} corrigidas, ${failures} falhas -> ${outPath}`);
  if (failures > 0) {
    console.error("reexecute o mesmo comando para tentar de novo as que falharam.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
