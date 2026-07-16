import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { getBalance } from "@/modules/credits";
import { billingProvider } from "./asaas";

export { processAsaasWebhook } from "./webhooks";
export { startBillingSweep, sweepBillingCycles } from "./cycles";

export async function listActivePlans() {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { active: true },
    orderBy: { priceCents: "asc" },
  });
  return plans.map((plan) => ({
    id: plan.id,
    tier: plan.tier,
    name: plan.name,
    priceCents: plan.priceCents,
    monthlyQuota: plan.monthlyQuota,
  }));
}

// Plano vigente do usuário (ou null se sem assinatura ativa). Considera o
// acesso ainda válido durante carência/cancelamento até o fim do período,
// alinhado às regras de consumo de crédito (modules/credits).
export async function getActiveTier(userId: string): Promise<"entry" | "premium" | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
  if (!subscription) {
    return null;
  }
  const accessibleStatuses = ["active", "past_due", "canceled"];
  const withinPeriod = new Date() < subscription.currentPeriodEnd;
  if (!accessibleStatuses.includes(subscription.status) || !withinPeriod) {
    return null;
  }
  return subscription.plan.tier;
}

const cardSchema = z.object({
  holderName: z.string().min(1),
  number: z.string().min(13),
  expiryMonth: z.string().length(2),
  expiryYear: z.string().length(4),
  ccv: z.string().min(3).max(4),
});

export const subscribeSchema = z.object({
  planId: z.string().uuid(),
  method: z.enum(["card", "pix"]),
  card: cardSchema.optional(),
});

// Cria a assinatura no Asaas SEM conceder nada — direitos só chegam pelo
// webhook de pagamento confirmado (FR-024).
export async function subscribe(userId: string, input: z.infer<typeof subscribeSchema>) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
  if (!plan || !plan.active) {
    throw new ApiError("VALIDATION_ERROR", 400, "Plano não encontrado.");
  }
  if (input.method === "card" && !input.card) {
    throw new ApiError("VALIDATION_ERROR", 400, "Informe os dados do cartão.");
  }

  const existing = await prisma.subscription.findUnique({ where: { userId } });
  const now = new Date();
  if (
    existing &&
    ["active", "past_due", "canceled"].includes(existing.status) &&
    existing.currentPeriodEnd > now
  ) {
    throw new ApiError("INVALID_STATE", 409, "Você já tem uma assinatura vigente.");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  let customerId = user.asaasCustomerId;
  if (!customerId) {
    const customer = await billingProvider().createCustomer({
      name: user.name,
      email: user.email,
      externalReference: user.id,
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { asaasCustomerId: customerId } });
  }

  const created = await billingProvider().createSubscription({
    customerId,
    valueCents: plan.priceCents,
    description: `Argos — ${plan.name}`,
    method: input.method,
    card: input.card,
    externalReference: userId,
  });

  const subscription = await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planId: plan.id,
      asaasSubscriptionId: created.id,
      status: "expired", // sem direitos até o webhook confirmar o pagamento
      currentPeriodStart: now,
      currentPeriodEnd: now,
    },
    update: {
      planId: plan.id,
      asaasSubscriptionId: created.id,
      status: "expired",
      currentPeriodStart: now,
      currentPeriodEnd: now,
      cancelAtPeriodEnd: false,
    },
  });

  let pixQrCode: string | null = null;
  let pixQrImage: string | null = null;
  if (created.firstPaymentId) {
    await prisma.paymentTransaction.upsert({
      where: { asaasPaymentId: created.firstPaymentId },
      create: {
        userId,
        subscriptionId: subscription.id,
        asaasPaymentId: created.firstPaymentId,
        kind: "cycle",
        amountCents: plan.priceCents,
        method: input.method,
        status: "pending",
      },
      update: {},
    });
    if (input.method === "pix") {
      const qr = await billingProvider().getPaymentPixQr(created.firstPaymentId);
      pixQrCode = qr?.payload ?? null;
      pixQrImage = qr?.encodedImage ?? null;
    }
  }

  return { status: "pending_payment", pixQrCode, pixQrImage };
}

// Fração não usada do ciclo corrente × diferença de preço (R4, FR-025).
export function computeProrationCents(
  periodStart: Date,
  periodEnd: Date,
  now: Date,
  priceDifferenceCents: number,
): number {
  const periodMs = periodEnd.getTime() - periodStart.getTime();
  const remainingFraction = Math.max(
    0,
    Math.min(1, (periodEnd.getTime() - now.getTime()) / Math.max(periodMs, 1)),
  );
  return Math.round(priceDifferenceCents * remainingFraction);
}

export const upgradeSchema = z.object({
  method: z.enum(["card", "pix"]).default("pix"),
  card: cardSchema.optional(),
});

// Upgrade entry → premium com cobrança proporcional (R4, FR-025/026).
// A troca de plano e a cota extra são aplicadas na confirmação da cobrança.
export async function upgrade(userId: string, input: z.infer<typeof upgradeSchema>) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
  if (!subscription || subscription.status !== "active") {
    throw new ApiError(
      "INVALID_STATE",
      409,
      "Você precisa de uma assinatura ativa para fazer upgrade.",
    );
  }
  if (subscription.plan.tier === "premium") {
    throw new ApiError("INVALID_STATE", 409, "Você já está no plano premium.");
  }
  const premium = await prisma.subscriptionPlan.findFirst({
    where: { tier: "premium", active: true },
  });
  if (!premium) {
    throw new ApiError("INTERNAL", 500, "Plano premium indisponível.");
  }

  const prorationCents = computeProrationCents(
    subscription.currentPeriodStart,
    subscription.currentPeriodEnd,
    new Date(),
    premium.priceCents - subscription.plan.priceCents,
  );

  await billingProvider().updateSubscriptionValue(
    subscription.asaasSubscriptionId,
    premium.priceCents,
  );

  if (prorationCents <= 0) {
    const { applyUpgrade } = await import("./webhooks");
    await applyUpgrade(subscription.id);
    return { status: "upgraded", amountCents: 0, pixQrCode: null, pixQrImage: null };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const charge = await billingProvider().createOneOffCharge({
    customerId: user.asaasCustomerId!,
    valueCents: prorationCents,
    description: "Argos — upgrade para o plano Premium (proporcional)",
    method: input.method,
    card: input.card,
    externalReference: userId,
  });
  await prisma.paymentTransaction.create({
    data: {
      userId,
      subscriptionId: subscription.id,
      asaasPaymentId: charge.id,
      kind: "upgrade_proration",
      amountCents: prorationCents,
      method: input.method,
      status: "pending",
    },
  });

  let pixQrCode: string | null = null;
  let pixQrImage: string | null = null;
  if (input.method === "pix") {
    const qr = await billingProvider().getPaymentPixQr(charge.id);
    pixQrCode = qr?.payload ?? null;
    pixQrImage = qr?.encodedImage ?? null;
  }
  return { status: "pending_payment", amountCents: prorationCents, pixQrCode, pixQrImage };
}

// Cancela a renovação mantendo acesso até o fim do período pago (FR-025).
export async function cancel(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription || !["active", "past_due"].includes(subscription.status)) {
    throw new ApiError("INVALID_STATE", 409, "Não há assinatura ativa para cancelar.");
  }
  await billingProvider().cancelSubscription(subscription.asaasSubscriptionId);
  return prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "canceled", cancelAtPeriodEnd: true },
  });
}

export async function getSubscriptionView(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
  if (!subscription || subscription.status === "expired") {
    return null;
  }
  const balance = await getBalance(userId);

  // Renovação Pix pendente → o app mostra banner com o QR (clarificação 5 / U1).
  const pendingPix = await prisma.paymentTransaction.findFirst({
    where: { userId, status: "pending", method: "pix" },
    orderBy: { createdAt: "desc" },
  });
  let pendingPixPayment: {
    amountCents: number;
    pixQrCode: string | null;
    pixQrImage: string | null;
  } | null = null;
  if (pendingPix) {
    const qr = await billingProvider().getPaymentPixQr(pendingPix.asaasPaymentId);
    pendingPixPayment = {
      amountCents: pendingPix.amountCents,
      pixQrCode: qr?.payload ?? null,
      pixQrImage: qr?.encodedImage ?? null,
    };
  }

  return {
    tier: subscription.plan.tier,
    planName: subscription.plan.name,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    monthlyQuota: subscription.plan.monthlyQuota,
    quotaRemaining: balance.quotaRemaining,
    pendingPixPayment,
  };
}
