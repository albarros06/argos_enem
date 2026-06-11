import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeProrationCents, sweepBillingCycles } from "@/modules/billing";
import { cycleIdFor, getBalance, grantQuota } from "@/modules/credits";
import { createUser, resetDb, seedPlans } from "../helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("proration math", () => {
  const start = new Date("2026-06-01T00:00:00Z");
  const end = new Date("2026-07-01T00:00:00Z");
  const priceDiff = 2000; // premium − entry, em centavos

  it("charges the full difference at cycle start", () => {
    expect(computeProrationCents(start, end, start, priceDiff)).toBe(2000);
  });

  it("charges half the difference mid-cycle", () => {
    const midpoint = new Date((start.getTime() + end.getTime()) / 2);
    expect(computeProrationCents(start, end, midpoint, priceDiff)).toBe(1000);
  });

  it("charges nothing at or after cycle end", () => {
    expect(computeProrationCents(start, end, end, priceDiff)).toBe(0);
    expect(computeProrationCents(start, end, new Date(end.getTime() + DAY_MS), priceDiff)).toBe(0);
  });

  it("clamps dates before the cycle start to the full difference", () => {
    expect(computeProrationCents(start, end, new Date(start.getTime() - DAY_MS), priceDiff)).toBe(
      2000,
    );
  });
});

async function subscriptionWithStatus(
  status: "active" | "past_due" | "canceled",
  periodEnd: Date,
  quota = 5,
) {
  const { entry } = await seedPlans();
  const user = await createUser();
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: entry.id,
      asaasSubscriptionId: `sub_${status}`,
      status,
      currentPeriodStart: new Date(periodEnd.getTime() - 30 * DAY_MS),
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: status === "canceled",
    },
  });
  await grantQuota(user.id, quota, cycleIdFor(subscription.id, subscription.currentPeriodStart));
  return { user, subscription };
}

describe("billing cycle sweep", () => {
  beforeEach(resetDb);

  it("expires unused quota and moves an unpaid active subscription to past_due", async () => {
    const { user, subscription } = await subscriptionWithStatus(
      "active",
      new Date(Date.now() - DAY_MS),
    );

    await sweepBillingCycles();

    const updated = await prisma.subscription.findUniqueOrThrow({
      where: { id: subscription.id },
    });
    expect(updated.status).toBe("past_due");
    const cycleSum = await prisma.creditTransaction.aggregate({
      _sum: { amount: true },
      where: {
        userId: user.id,
        cycleId: cycleIdFor(subscription.id, subscription.currentPeriodStart),
      },
    });
    expect(cycleSum._sum.amount).toBe(0);
  });

  it("expires a past_due subscription after the grace period", async () => {
    const { subscription } = await subscriptionWithStatus(
      "past_due",
      new Date(Date.now() - 8 * DAY_MS), // carência padrão: 7 dias
    );

    await sweepBillingCycles();

    const updated = await prisma.subscription.findUniqueOrThrow({
      where: { id: subscription.id },
    });
    expect(updated.status).toBe("expired");
  });

  it("keeps a past_due subscription within the grace period", async () => {
    const { subscription } = await subscriptionWithStatus(
      "past_due",
      new Date(Date.now() - 2 * DAY_MS),
    );

    await sweepBillingCycles();

    const updated = await prisma.subscription.findUniqueOrThrow({
      where: { id: subscription.id },
    });
    expect(updated.status).toBe("past_due");
  });

  it("expires a canceled subscription at period end", async () => {
    const { user, subscription } = await subscriptionWithStatus(
      "canceled",
      new Date(Date.now() - DAY_MS),
    );

    await sweepBillingCycles();

    const updated = await prisma.subscription.findUniqueOrThrow({
      where: { id: subscription.id },
    });
    expect(updated.status).toBe("expired");
    expect((await getBalance(user.id)).quotaRemaining).toBe(0);
  });

  it("does not touch active subscriptions whose period has not ended", async () => {
    const { user, subscription } = await subscriptionWithStatus(
      "active",
      new Date(Date.now() + 10 * DAY_MS),
    );

    await sweepBillingCycles();

    const updated = await prisma.subscription.findUniqueOrThrow({
      where: { id: subscription.id },
    });
    expect(updated.status).toBe("active");
    expect((await getBalance(user.id)).quotaRemaining).toBe(5);
  });
});
