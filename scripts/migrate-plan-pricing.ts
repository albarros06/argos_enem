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

// Migração de preço/cota (execução única): desativa os planos vigentes e cria
// novos planos ativos com os novos valores. Assinaturas existentes continuam
// apontando (via planId) para o plano antigo — nada muda para quem já assina,
// até que resubscreva/troque de plano. Novos cadastros só veem os planos
// ativos (listActivePlans filtra active: true).
//
// Uso:
//   npx tsx scripts/migrate-plan-pricing.ts
const NEW_PLANS = [
  { tier: "entry" as const, name: "Plano Essencial", priceCents: 2990, monthlyQuota: 4 },
  { tier: "premium" as const, name: "Plano Premium", priceCents: 3990, monthlyQuota: 12 },
];

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const plan of NEW_PLANS) {
      const deactivated = await tx.subscriptionPlan.updateMany({
        where: { tier: plan.tier, active: true },
        data: { active: false },
      });
      const created = await tx.subscriptionPlan.create({ data: { ...plan, active: true } });
      console.log(
        `${plan.tier}: desativado(s) ${deactivated.count} plano(s) antigo(s); ` +
          `criado novo plano ${created.id} (${created.name}, R$${(created.priceCents / 100).toFixed(2)}, ` +
          `${created.monthlyQuota} correções/mês).`,
      );
    }
  });
  console.log("Migração de preços concluída.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
