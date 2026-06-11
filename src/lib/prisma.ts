import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Sob pico (SC-008) dezenas de correções concorrem pelo pool de conexões;
    // as transações são curtas (inserts no ledger), então esperar na fila é
    // melhor do que falhar com "Unable to start a transaction".
    transactionOptions: { maxWait: 30_000, timeout: 30_000 },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
