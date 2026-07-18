import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { cycleIdFor, grantQuota } from "@/modules/credits";
import { openNewCycle } from "./cycles";

export interface AsaasWebhookBody {
  id?: string;
  event: string;
  payment?: {
    id: string;
    subscription?: string;
    customer?: string;
    value?: number;
    billingType?: string;
    externalReference?: string;
  };
  subscription?: { id: string };
}

// Processamento idempotente: o id do evento é chave primária de WebhookEvent —
// entregas repetidas do Asaas são ignoradas com 200 (R4).
export async function processAsaasWebhook(body: AsaasWebhookBody) {
  const eventId =
    body.id ?? `${body.event}:${body.payment?.id ?? body.subscription?.id ?? "unknown"}`;
  try {
    await prisma.webhookEvent.create({
      data: { id: eventId, payload: body as unknown as Prisma.InputJsonValue },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { duplicate: true };
    }
    throw error;
  }

  switch (body.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      if (body.payment) {
        await handlePaymentConfirmed(body.payment);
      }
      break;
    case "PAYMENT_OVERDUE":
      if (body.payment?.subscription) {
        await prisma.subscription.updateMany({
          where: { asaasSubscriptionId: body.payment.subscription, status: "active" },
          data: { status: "past_due" },
        });
      }
      break;
    case "PAYMENT_DELETED":
      // Cobrança apagada/expirada no Asaas (ex.: novo QR emitido sem pagar o
      // anterior) → invalida a transação para o banner "Pix pendente" sumir.
      if (body.payment) {
        await prisma.paymentTransaction.updateMany({
          where: { asaasPaymentId: body.payment.id, status: "pending" },
          data: { status: "failed" },
        });
      }
      break;
    case "SUBSCRIPTION_DELETED":
      if (body.subscription) {
        await prisma.subscription.updateMany({
          where: {
            asaasSubscriptionId: body.subscription.id,
            status: { in: ["active", "past_due"] },
          },
          data: { status: "canceled", cancelAtPeriodEnd: true },
        });
      }
      break;
    default:
      logger.info("webhook_event_ignored", { event: body.event });
  }
  return { duplicate: false };
}

async function handlePaymentConfirmed(payment: NonNullable<AsaasWebhookBody["payment"]>) {
  const existing = await prisma.paymentTransaction.findUnique({
    where: { asaasPaymentId: payment.id },
  });
  if (existing?.status === "confirmed") {
    return;
  }

  if (existing?.kind === "upgrade_proration") {
    await prisma.paymentTransaction.update({
      where: { id: existing.id },
      data: { status: "confirmed" },
    });
    if (existing.subscriptionId) {
      await applyUpgrade(existing.subscriptionId);
    }
    return;
  }

  // Pagamento de ciclo (primeiro ou renovação): ativa e abre novo ciclo de cota.
  const subscription = payment.subscription
    ? await prisma.subscription.findFirst({
        where: { asaasSubscriptionId: payment.subscription },
        include: { plan: true },
      })
    : existing?.subscriptionId
      ? await prisma.subscription.findUnique({
          where: { id: existing.subscriptionId },
          include: { plan: true },
        })
      : null;
  if (!subscription) {
    logger.warn("webhook_payment_without_subscription", { paymentId: payment.id });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await openNewCycle(subscription, subscription.plan, tx);
    await tx.paymentTransaction.upsert({
      where: { asaasPaymentId: payment.id },
      create: {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        asaasPaymentId: payment.id,
        kind: "cycle",
        amountCents: Math.round((payment.value ?? 0) * 100),
        method: payment.billingType === "PIX" ? "pix" : "card",
        status: "confirmed",
      },
      update: { status: "confirmed" },
    });
  });
  logger.info("subscription_cycle_activated", { subscriptionId: subscription.id });
}

// Troca o plano para premium e concede imediatamente a diferença de cota no
// ciclo corrente (R4 — aplicado na confirmação da cobrança proporcional).
export async function applyUpgrade(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  if (!subscription || subscription.plan.tier === "premium") {
    return;
  }
  const premium = await prisma.subscriptionPlan.findFirst({
    where: { tier: "premium", active: true },
  });
  if (!premium) {
    logger.error("upgrade_without_premium_plan", { subscriptionId });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { planId: premium.id },
    });
    const quotaDiff = premium.monthlyQuota - subscription.plan.monthlyQuota;
    if (quotaDiff > 0) {
      await grantQuota(
        subscription.userId,
        quotaDiff,
        cycleIdFor(subscription.id, subscription.currentPeriodStart),
        tx,
      );
    }
  });
  logger.info("subscription_upgraded", { subscriptionId });
}
