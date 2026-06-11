import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { storage } from "@/lib/storage";
import { cancel as cancelSubscription } from "@/modules/billing";

// Exclusão de conta LGPD (FR-028). A rota marca deletedAt (revoga o acesso de
// imediato — requireUser rejeita contas marcadas) e dispara o job assíncrono.
export async function requestAccountDeletion(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
  void runAccountDeletion(userId).catch((error) => {
    logger.error("account_deletion_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

// Ordem do data-model: cancelar assinatura no Asaas → apagar objetos restantes
// no R2 → apagar dados do usuário → anonimizar pagamentos (retenção fiscal) →
// apagar o User.
export async function runAccountDeletion(userId: string): Promise<void> {
  try {
    await cancelSubscription(userId);
  } catch (error) {
    // Sem assinatura ativa ou falha no gateway — nada pode bloquear o direito
    // de exclusão (LGPD).
    logger.warn("deletion_subscription_cancel_skipped", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const withImages = await prisma.submission.findMany({
    where: { userId, imageKey: { not: null } },
    select: { imageKey: true },
  });
  for (const submission of withImages) {
    try {
      await storage().deleteObject(submission.imageKey!);
    } catch (error) {
      logger.warn("deletion_image_delete_failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.updateMany({
      where: { userId },
      data: { userId: null },
    });
    // Annotations/Evaluations/Transcriptions/Submissions/CreditTransactions/
    // AuthTokens/Subscription caem em cascata com o User (schema onDelete).
    await tx.user.delete({ where: { id: userId } });
  });
  logger.info("account_deleted", { userId });
}
