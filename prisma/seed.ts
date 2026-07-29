import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Business numbers live here as seed data, never as literals in business logic (R11).
const plans = [
  { tier: "entry" as const, name: "Plano Essencial", priceCents: 2990, monthlyQuota: 4 },
  { tier: "premium" as const, name: "Plano Premium", priceCents: 3990, monthlyQuota: 12 },
];

const themes = [
  { title: "Perspectivas acerca do envelhecimento na sociedade brasileira", year: 2025 },
  { title: "Desafios para a valorização da herança africana no Brasil", year: 2024 },
  {
    title:
      "Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil",
    year: 2023,
  },
  {
    title: "Desafios para a valorização de comunidades e povos tradicionais no Brasil",
    year: 2022,
  },
  {
    title: "Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil",
    year: 2021,
  },
  { title: "O estigma associado às doenças mentais na sociedade brasileira", year: 2020 },
  { title: "Democratização do acesso ao cinema no Brasil", year: 2019 },
  {
    title: "Manipulação do comportamento do usuário pelo controle de dados na internet",
    year: 2018,
  },
  { title: "Desafios para a formação educacional de surdos no Brasil", year: 2017 },
];

async function main() {
  for (const plan of plans) {
    const existing = await prisma.subscriptionPlan.findFirst({
      where: { tier: plan.tier, active: true },
    });
    if (!existing) {
      await prisma.subscriptionPlan.create({ data: plan });
    }
  }

  for (const theme of themes) {
    const existing = await prisma.essayTheme.findFirst({ where: { title: theme.title } });
    if (!existing) {
      await prisma.essayTheme.create({ data: theme });
    }
  }

  console.log("Seed concluído: planos e temas disponíveis.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
