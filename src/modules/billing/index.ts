import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { getBalance } from "@/modules/credits";
import { isValidCpfCnpj, sanitizeCpfCnpj } from "@/lib/cpfCnpj";
import { billingProvider, type CardHolderInfo } from "./asaas";

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
  // Dados do titular exigidos pelo Asaas (creditCardHolderInfo) na captura de
  // cartão. Nome/e-mail/CPF vêm da conta; CEP, número e telefone do formulário.
  postalCode: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 8, "CEP inválido."),
  addressNumber: z.string().min(1),
  phone: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 10, "Telefone inválido."),
});

export const subscribeSchema = z.object({
  planId: z.string().uuid(),
  method: z.enum(["card", "pix"]),
  card: cardSchema.optional(),
  cpfCnpj: z
    .string()
    .refine(isValidCpfCnpj, "CPF ou CNPJ inválido.")
    .transform(sanitizeCpfCnpj),
});

// Monta o creditCardHolderInfo exigido pelo Asaas: nome/e-mail/CPF da conta +
// endereço/telefone do formulário. Deve bater com o cadastro do emissor.
function cardHolderInfo(
  user: { email: string },
  cpfCnpj: string,
  card: z.infer<typeof cardSchema>,
): CardHolderInfo {
  return {
    name: card.holderName,
    email: user.email,
    cpfCnpj,
    postalCode: card.postalCode,
    addressNumber: card.addressNumber,
    phone: card.phone,
  };
}

// Cria a assinatura no Asaas SEM conceder nada — direitos só chegam pelo
// webhook de pagamento confirmado (FR-024). remoteIp é o IP do comprador,
// obrigatório na captura de cartão (antifraude do Asaas).
export async function subscribe(
  userId: string,
  input: z.infer<typeof subscribeSchema>,
  remoteIp?: string | null,
) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
  if (!plan || !plan.active) {
    throw new ApiError("VALIDATION_ERROR", 400, "Plano não encontrado.");
  }
  if (input.method === "card" && !input.card) {
    throw new ApiError("VALIDATION_ERROR", 400, "Informe os dados do cartão.");
  }

  const existing = await prisma.subscription.findUnique({ where: { userId } });
  const now = new Date();
  // Dentro do período pago (inclui a cancelada, que reativa em um clique) não
  // se assina de novo — evita cobrança dupla e perda dos dias já pagos. Fora do
  // período (expirada/vencida) o checkout inicia uma assinatura nova.
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
      cpfCnpj: input.cpfCnpj,
      externalReference: user.id,
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { asaasCustomerId: customerId, cpfCnpj: input.cpfCnpj },
    });
  } else if (user.cpfCnpj !== input.cpfCnpj) {
    await prisma.user.update({ where: { id: userId }, data: { cpfCnpj: input.cpfCnpj } });
  }

  const created = await billingProvider().createSubscription({
    customerId,
    valueCents: plan.priceCents,
    description: `Argos — ${plan.name}`,
    method: input.method,
    card: input.card,
    holderInfo: input.card ? cardHolderInfo(user, input.cpfCnpj, input.card) : undefined,
    remoteIp: remoteIp ?? undefined,
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

  // Cobranças Pix anteriores em aberto ficam órfãs (o usuário gerou um novo QR
  // sem pagar o antigo). Invalida-as para não sobrar banner "Pix pendente".
  await prisma.paymentTransaction.updateMany({
    where: { userId, status: "pending", method: "pix" },
    data: { status: "failed" },
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
export async function upgrade(
  userId: string,
  input: z.infer<typeof upgradeSchema>,
  remoteIp?: string | null,
) {
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
  if (input.card && !user.cpfCnpj) {
    throw new ApiError("VALIDATION_ERROR", 400, "CPF ou CNPJ do titular não encontrado.");
  }
  const charge = await billingProvider().createOneOffCharge({
    customerId: user.asaasCustomerId!,
    valueCents: prorationCents,
    description: "Argos — upgrade para o plano Premium (proporcional)",
    method: input.method,
    card: input.card,
    holderInfo: input.card ? cardHolderInfo(user, user.cpfCnpj!, input.card) : undefined,
    remoteIp: remoteIp ?? undefined,
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
// Soft-cancel: desativa no Asaas (para de gerar cobranças) sem apagar, para
// permitir reativação em um clique enquanto o período pago não termina.
export async function cancel(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription || !["active", "past_due"].includes(subscription.status)) {
    throw new ApiError("INVALID_STATE", 409, "Não há assinatura ativa para cancelar.");
  }
  await billingProvider().deactivateSubscription(subscription.asaasSubscriptionId);
  return prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "canceled", cancelAtPeriodEnd: true },
  });
}

// Reativa uma assinatura cancelada ainda dentro do período pago: um clique, sem
// cobrança, preservando cota e data de renovação. Religa a assinatura no Asaas
// com a próxima cobrança agendada para o fim do período atual. Se o período já
// terminou, o usuário assina de novo pelo checkout (nova cobrança).
export async function reactivate(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription || subscription.status !== "canceled") {
    throw new ApiError("INVALID_STATE", 409, "Não há assinatura cancelada para reativar.");
  }
  if (subscription.currentPeriodEnd <= new Date()) {
    throw new ApiError(
      "INVALID_STATE",
      409,
      "Seu período de acesso terminou. Assine novamente para voltar.",
    );
  }
  await billingProvider().reactivateSubscription(
    subscription.asaasSubscriptionId,
    subscription.currentPeriodEnd,
  );
  return prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "active", cancelAtPeriodEnd: false },
  });
}

// Encerramento definitivo (exclusão de conta / LGPD): apaga a assinatura no
// Asaas independentemente do status — não reversível, ao contrário de cancel().
export async function terminateSubscription(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription) {
    return;
  }
  await billingProvider().cancelSubscription(subscription.asaasSubscriptionId);
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
  // Antes de exibir, reconcilia o status local com o Asaas: cobranças
  // abandonadas ficam "pending" para sempre no nosso banco (o webhook só marca
  // pagamento confirmado), então consultamos o status real para não deixar
  // banner "Pix pendente" fantasma.
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
    const realStatus = await billingProvider().getPaymentStatus(pendingPix.asaasPaymentId);
    const actionable = realStatus === "PENDING" || realStatus === "AWAITING_RISK_ANALYSIS";
    const paid =
      realStatus === "RECEIVED" ||
      realStatus === "CONFIRMED" ||
      realStatus === "RECEIVED_IN_CASH";
    if (actionable) {
      const qr = await billingProvider().getPaymentPixQr(pendingPix.asaasPaymentId);
      pendingPixPayment = {
        amountCents: pendingPix.amountCents,
        pixQrCode: qr?.payload ?? null,
        pixQrImage: qr?.encodedImage ?? null,
      };
    } else if (realStatus && !paid) {
      // Terminal e sem pagamento (OVERDUE, DELETED, REFUNDED, ...): invalida
      // localmente para o banner sumir. Se pago, o webhook cuida do ciclo —
      // não mexemos no status aqui para não atropelar a abertura da cota.
      await prisma.paymentTransaction.update({
        where: { id: pendingPix.id },
        data: { status: "failed" },
      });
    }
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
