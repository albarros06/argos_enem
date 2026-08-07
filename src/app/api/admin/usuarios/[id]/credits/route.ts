import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { grantCreditAdjustment } from "@/modules/admin";

export const dynamic = "force-dynamic";

const creditAdjustmentSchema = z.object({
  amount: z
    .number()
    .int()
    .refine((value) => value !== 0, "Quantidade não pode ser zero."),
  reason: z.string().trim().min(1, "Informe o motivo.").max(500),
});

export const POST = handleRoute<{ id: string }>(async (request, context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const { amount, reason } = await parseBody(request, creditAdjustmentSchema);

  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!target) {
    throw new ApiError("NOT_FOUND", 404, "Usuário não encontrado.");
  }

  const result = await grantCreditAdjustment(admin.id, id, amount, reason);
  return NextResponse.json(result);
});
