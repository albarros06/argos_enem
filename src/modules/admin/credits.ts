import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { getBalance, grantManualCredits, type CreditBalance } from "@/modules/credits";
import { recordAdminAction, type AuditEntry } from "./auditLog";

const MAX_REASON_LENGTH = 500;

export interface CreditAdjustmentResult {
  balance: CreditBalance;
  auditEntry: AuditEntry;
}

// Concede ou deduz créditos manuais e registra a ação em uma única transação
// (FR-007..010) — amount != 0 e reason não-vazio são obrigatórios, senão nada
// é escrito em nenhuma das duas tabelas.
export async function grantCreditAdjustment(
  adminId: string,
  targetUserId: string,
  amount: number,
  reason: string,
): Promise<CreditAdjustmentResult> {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new ApiError(
      "VALIDATION_ERROR",
      400,
      "Quantidade deve ser um número inteiro diferente de zero.",
    );
  }
  const trimmedReason = reason.trim();
  if (!trimmedReason || trimmedReason.length > MAX_REASON_LENGTH) {
    throw new ApiError("VALIDATION_ERROR", 400, "Informe um motivo (até 500 caracteres).");
  }

  const auditEntry = await prisma.$transaction(async (tx) => {
    await grantManualCredits(targetUserId, amount, tx);
    return recordAdminAction(adminId, "credit_grant", targetUserId, amount, trimmedReason, tx);
  });

  return { balance: await getBalance(targetUserId), auditEntry };
}
