import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getRevenueSummary } from "@/modules/admin/revenue";
import { createUser, resetDb, seedPlans } from "../../helpers";

async function subscribe(
  userId: string,
  planId: string,
  status: "active" | "past_due" | "canceled" | "expired",
) {
  const now = new Date();
  return prisma.subscription.create({
    data: {
      userId,
      planId,
      asaasSubscriptionId: `sub_${userId}`,
      status,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}

describe("admin getRevenueSummary", () => {
  beforeEach(resetDb);

  it("sums MRR only over active subscriptions at their plan price", async () => {
    const { entry, premium } = await seedPlans();
    const activeEntry = await createUser();
    const activePremium = await createUser();
    const pastDue = await createUser();
    await subscribe(activeEntry.id, entry.id, "active");
    await subscribe(activePremium.id, premium.id, "active");
    await subscribe(pastDue.id, entry.id, "past_due");

    const summary = await getRevenueSummary();

    expect(summary.mrrCents).toBe(entry.priceCents + premium.priceCents);
  });

  it("breaks down subscriber counts by tier and status", async () => {
    const { entry, premium } = await seedPlans();
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    await subscribe(a.id, entry.id, "active");
    await subscribe(b.id, entry.id, "active");
    await subscribe(c.id, premium.id, "canceled");

    const summary = await getRevenueSummary();

    expect(summary.subscribersByTierAndStatus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tier: "entry", status: "active", count: 2 }),
        expect.objectContaining({ tier: "premium", status: "canceled", count: 1 }),
      ]),
    );
  });

  it("orders recent payments newest-first and caps at 20", async () => {
    const { entry } = await seedPlans();
    const user = await createUser();
    const subscription = await subscribe(user.id, entry.id, "active");

    for (let i = 0; i < 25; i++) {
      await prisma.paymentTransaction.create({
        data: {
          userId: user.id,
          subscriptionId: subscription.id,
          asaasPaymentId: `pay_${i}`,
          kind: "cycle",
          amountCents: 1000 + i,
          method: "pix",
          status: "confirmed",
          createdAt: new Date(Date.now() + i * 1000),
        },
      });
    }

    const summary = await getRevenueSummary();

    expect(summary.recentPayments).toHaveLength(20);
    expect(summary.recentPayments[0].amountCents).toBe(1024);
    expect(summary.recentPayments[0].userEmail).toBe(user.email);
  });

  it("returns zeros/empty arrays when there are no subscriptions", async () => {
    const summary = await getRevenueSummary();

    expect(summary.mrrCents).toBe(0);
    expect(summary.subscribersByTierAndStatus).toEqual([]);
    expect(summary.recentPayments).toEqual([]);
  });
});
