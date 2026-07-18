import fs from "fs";
import path from "path";

// Carrega .env ANTES de importar prisma. process.loadEnvFile (Node 20.12+) usa o
// parser do dotenv — o bash `source` não lê este .env (JSON multilinha). Vars já
// no ambiente têm precedência.
const ENV_FILE = process.env.ENV_FILE ?? path.join(__dirname, "../.env");
if (fs.existsSync(ENV_FILE)) {
  const before = { ...process.env };
  process.loadEnvFile(ENV_FILE);
  for (const [k, v] of Object.entries(before)) if (v !== undefined) process.env[k] = v;
}

const { prisma } = require("../src/lib/prisma") as typeof import("../src/lib/prisma");
const { getBalance, grantManualCredits } =
  require("../src/modules/credits") as typeof import("../src/modules/credits");

// Concede créditos manuais (livres, sem expiração) a uma conta existente,
// identificada pelo e-mail. Registra no ledger com kind `manual_grant` para
// manter a auditoria distinta de bônus de cadastro e cota de assinatura.
//
// Uso (carrega .env sozinho):
//   npx tsx scripts/add-credits.ts usuario@email.com 10
async function main() {
  const email = process.argv[2];
  const amount = Number(process.argv[3]);

  if (!email || !process.argv[3]) {
    console.error("Uso: npx tsx scripts/add-credits.ts <email> <quantidade>");
    process.exit(1);
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    console.error(`Quantidade inválida: "${process.argv[3]}" — informe um inteiro positivo.`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Nenhuma conta encontrada com o e-mail ${email}.`);
    process.exit(1);
  }

  const before = await getBalance(user.id);
  await grantManualCredits(user.id, amount);
  const after = await getBalance(user.id);

  console.log(
    `Concedidos ${amount} crédito(s) a ${email}.\n` +
      `  freeRemaining: ${before.freeRemaining} -> ${after.freeRemaining}\n` +
      `  quotaRemaining: ${after.quotaRemaining} (inalterado)`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
