import { prisma } from "../src/lib/prisma";

// Promove uma conta existente a administrador. Uso:
//   npx tsx scripts/promote-admin.ts usuario@email.com
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Informe o e-mail: npx tsx scripts/promote-admin.ts usuario@email.com");
    process.exit(1);
  }
  const user = await prisma.user.update({ where: { email }, data: { role: "admin" } });
  console.log(`Conta ${user.email} promovida a administrador.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
