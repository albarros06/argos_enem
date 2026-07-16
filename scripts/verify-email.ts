import { prisma } from "../src/lib/prisma";

// Marca o e-mail de uma conta existente como verificado, sem enviar o link.
// Útil enquanto o Resend não está configurado. Uso:
//   npx tsx scripts/verify-email.ts usuario@email.com
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Informe o e-mail: npx tsx scripts/verify-email.ts usuario@email.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Nenhuma conta encontrada para ${email}.`);
    process.exit(1);
  }
  if (user.emailVerifiedAt) {
    console.log(`Conta ${user.email} já estava verificada em ${user.emailVerifiedAt.toISOString()}.`);
    return;
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { emailVerifiedAt: new Date() },
  });
  console.log(`Conta ${updated.email} verificada em ${updated.emailVerifiedAt!.toISOString()}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
