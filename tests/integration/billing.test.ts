import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getBalance, consumeCredit } from "@/modules/credits";
import {
  actAs,
  createSubmissionRow,
  createUser,
  jsonRequest,
  resetDb,
  routeContext,
  seedPlans,
} from "../helpers";

vi.mock("next-auth", () => ({
  default: () => ({
    handlers: { GET: async () => new Response(null), POST: async () => new Response(null) },
    auth: async () => {
      const userId = (globalThis as { __testUserId?: string | null }).__testUserId;
      return userId ? { user: { id: userId } } : null;
    },
    signIn: async () => undefined,
    signOut: async () => undefined,
  }),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (config: unknown) => config }));

import { POST as subscribeRoute } from "@/app/api/billing/subscribe/route";
import { POST as upgradeRoute } from "@/app/api/billing/upgrade/route";
import { POST as cancelRoute } from "@/app/api/billing/cancel/route";
import { GET as subscriptionRoute } from "@/app/api/billing/subscription/route";
import { POST as webhookRoute } from "@/app/api/webhooks/asaas/route";

const WEBHOOK_TOKEN = "test-webhook-token";

function webhookRequest(body: unknown, token = WEBHOOK_TOKEN): Request {
  return new Request("http://localhost:3000/api/webhooks/asaas", {
    method: "POST",
    headers: { "Content-Type": "application/json", "asaas-access-token": token },
    body: JSON.stringify(body),
  });
}

async function subscribePix(userId: string, planId: string) {
  actAs(userId);
  const response = await subscribeRoute(
    jsonRequest("/api/billing/subscribe", "POST", { planId, method: "pix" }),
    routeContext({}),
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  const payment = await prisma.paymentTransaction.findFirstOrThrow({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const subscription = await prisma.subscription.findUniqueOrThrow({ where: { userId } });
  return { body, payment, subscription };
}

async function confirmPayment(eventId: string, paymentId: string, asaasSubscriptionId?: string) {
  return webhookRoute(
    webhookRequest({
      id: eventId,
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: paymentId,
        subscription: asaasSubscriptionId,
        value: 29.9,
        billingType: "PIX",
      },
    }),
    routeContext({}),
  );
}

describe("billing with the fake Asaas adapter", () => {
  beforeEach(resetDb);

  it("subscribe grants nothing before the webhook (FR-024)", async () => {
    const { entry } = await seedPlans();
    const user = await createUser();

    const { body, subscription } = await subscribePix(user.id, entry.id);
    expect(body.status).toBe("pending_payment");
    expect(body.pixQrCode).toBeTruthy();

    expect(subscription.status).toBe("expired"); // sem direitos ainda
    expect((await getBalance(user.id)).quotaRemaining).toBe(0);
  });

  it("rejects the webhook without the shared token", async () => {
    const response = await webhookRoute(
      webhookRequest({ id: "evt_x", event: "PAYMENT_CONFIRMED" }, "token-errado"),
      routeContext({}),
    );
    expect(response.status).toBe(401);
  });

  it("payment-confirmed webhook activates the cycle and grants quota exactly once", async () => {
    const { entry } = await seedPlans();
    const user = await createUser();
    const { payment, subscription } = await subscribePix(user.id, entry.id);

    const first = await confirmPayment(
      "evt_1",
      payment.asaasPaymentId,
      subscription.asaasSubscriptionId,
    );
    expect((await first.json()).duplicate).toBe(false);

    const activated = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(activated.status).toBe("active");
    expect((await getBalance(user.id)).quotaRemaining).toBe(entry.monthlyQuota);

    // Entrega duplicada do mesmo evento: 200, nenhum crédito a mais (R4).
    const duplicate = await confirmPayment(
      "evt_1",
      payment.asaasPaymentId,
      subscription.asaasSubscriptionId,
    );
    expect(duplicate.status).toBe(200);
    expect((await duplicate.json()).duplicate).toBe(true);
    expect((await getBalance(user.id)).quotaRemaining).toBe(entry.monthlyQuota);
  });

  it("payment overdue moves the subscription to past_due grace", async () => {
    const { entry } = await seedPlans();
    const user = await createUser();
    const { payment, subscription } = await subscribePix(user.id, entry.id);
    await confirmPayment("evt_1", payment.asaasPaymentId, subscription.asaasSubscriptionId);

    await webhookRoute(
      webhookRequest({
        id: "evt_2",
        event: "PAYMENT_OVERDUE",
        payment: { id: "pay_late", subscription: subscription.asaasSubscriptionId },
      }),
      routeContext({}),
    );

    const updated = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(updated.status).toBe("past_due");
    // Carência: a cota do ciclo corrente continua utilizável.
    expect((await getBalance(user.id)).quotaRemaining).toBe(entry.monthlyQuota);
  });

  it("cancel keeps quota and access until the period end (FR-025)", async () => {
    const { entry } = await seedPlans();
    const user = await createUser();
    const { payment, subscription } = await subscribePix(user.id, entry.id);
    await confirmPayment("evt_1", payment.asaasPaymentId, subscription.asaasSubscriptionId);

    actAs(user.id);
    const response = await cancelRoute(
      jsonRequest("/api/billing/cancel", "POST"),
      routeContext({}),
    );
    expect(response.status).toBe(200);

    const canceled = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(canceled.status).toBe("canceled");
    expect(canceled.cancelAtPeriodEnd).toBe(true);

    // Cota segue utilizável dentro do período pago.
    expect((await getBalance(user.id)).quotaRemaining).toBe(entry.monthlyQuota);
    const submission = await createSubmissionRow(user.id);
    await expect(consumeCredit(user.id, submission.id)).resolves.toMatchObject({ from: "quota" });
  });

  it("upgrade charges the proration and switches plan on confirmation (FR-025/026)", async () => {
    const { entry, premium } = await seedPlans();
    const user = await createUser();
    const { payment, subscription } = await subscribePix(user.id, entry.id);
    await confirmPayment("evt_1", payment.asaasPaymentId, subscription.asaasSubscriptionId);

    actAs(user.id);
    const response = await upgradeRoute(
      jsonRequest("/api/billing/upgrade", "POST", { method: "pix" }),
      routeContext({}),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("pending_payment");
    expect(body.amountCents).toBeGreaterThan(0); // ciclo recém-iniciado ≈ diferença cheia

    // Antes da confirmação da cobrança: plano e cota inalterados.
    expect((await getBalance(user.id)).quotaRemaining).toBe(entry.monthlyQuota);

    const proration = await prisma.paymentTransaction.findFirstOrThrow({
      where: { userId: user.id, kind: "upgrade_proration" },
    });
    await confirmPayment("evt_2", proration.asaasPaymentId);

    const upgraded = await prisma.subscription.findUniqueOrThrow({
      where: { userId: user.id },
      include: { plan: true },
    });
    expect(upgraded.plan.tier).toBe("premium");
    expect((await getBalance(user.id)).quotaRemaining).toBe(premium.monthlyQuota);
  });

  it("upgrade when already premium returns 409", async () => {
    const { premium } = await seedPlans();
    const user = await createUser();
    const { payment, subscription } = await subscribePix(user.id, premium.id);
    await confirmPayment("evt_1", payment.asaasPaymentId, subscription.asaasSubscriptionId);

    actAs(user.id);
    const response = await upgradeRoute(
      jsonRequest("/api/billing/upgrade", "POST", { method: "pix" }),
      routeContext({}),
    );
    expect(response.status).toBe(409);
  });

  it("exposes the subscription view with pending Pix payment", async () => {
    const { entry } = await seedPlans();
    const user = await createUser();
    const { payment, subscription } = await subscribePix(user.id, entry.id);
    await confirmPayment("evt_1", payment.asaasPaymentId, subscription.asaasSubscriptionId);

    // Simula a cobrança Pix do próximo ciclo ainda pendente.
    await prisma.paymentTransaction.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        asaasPaymentId: "pay_next_cycle",
        kind: "cycle",
        amountCents: entry.priceCents,
        method: "pix",
        status: "pending",
      },
    });

    actAs(user.id);
    const response = await subscriptionRoute(
      jsonRequest("/api/billing/subscription", "GET"),
      routeContext({}),
    );
    const view = await response.json();
    expect(view.tier).toBe("entry");
    expect(view.status).toBe("active");
    expect(view.pendingPixPayment).toMatchObject({ amountCents: entry.priceCents });
    expect(view.pendingPixPayment.pixQrCode).toBeTruthy();
  });
});
