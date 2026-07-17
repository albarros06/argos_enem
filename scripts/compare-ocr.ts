import fs from "fs";
import path from "path";
import { imageProviderFor } from "../src/modules/transcription/provider";

// Compara a transcrição do Vision (pixel) com a do Gemini (LLM) na MESMA imagem,
// para validar o ganho em papel com linhas/numeração e checar a fidelidade da
// Competência 1 (o Gemini NÃO deve corrigir os erros do aluno).
//
// Requer credenciais reais (GOOGLE_APPLICATION_CREDENTIALS_JSON etc.) no ambiente:
//   set -a; source .env; set +a
//   npx tsx scripts/compare-ocr.ts caminho/para/redacao.jpg
async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error("Uso: npx tsx scripts/compare-ocr.ts <caminho-da-imagem>");
    process.exit(1);
  }
  const bytes = fs.readFileSync(imagePath);
  const mimeType = path.extname(imagePath).toLowerCase() === ".png" ? "image/png" : "image/jpeg";

  console.log(`Imagem: ${imagePath} (${mimeType}, ${bytes.length} bytes)\n`);

  for (const kind of ["vision", "gemini"] as const) {
    const label = kind === "vision" ? "VISION (atual)" : "GEMINI (novo)";
    try {
      const started = Date.now();
      const result = await imageProviderFor(kind).extract(bytes, mimeType);
      const ms = Date.now() - started;
      console.log(`===== ${label} — ${ms}ms, confiança=${result.meanConfidence} =====`);
      console.log(result.text || "(vazio)");
      console.log("");
    } catch (error) {
      console.log(`===== ${label} — ERRO =====`);
      console.log(error instanceof Error ? error.message : String(error));
      console.log("");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
