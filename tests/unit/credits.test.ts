import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  consumeCredit,
  cycleIdFor,
  expireQuota,
  getBalance,
  grantQuota,
  InsufficientCreditsError,
  refundCredit,
} from "@/modules/credits";
import { createSubmissionRow, createUser, resetDb, seedPlans } from "../helpers";

async function userWithActiveSubscription(quota: number) {
  const { entry } = await seedPlans();
  const user = await createUser();
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: entry.id,
      asaasSubscriptionId: "sub_test",
      status: "active",
      currentPeriodStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000),
    },
  });
  const cycleId = cycleIdFor(subscription.id, subscription.currentPeriodStart);
  await grantQuota(user.id, quota, cycleId);
  return { user, subscription, cycleId };
}

describe("credits ledger", () => {
  beforeEach(resetDb);

  it("grants 3 free credits at signup", async () => {
    const user = await createUser();
    const balance = await getBalance(user.id);
    expect(balance.freeRemaining).toBe(3);
    expect(balance.quotaRemaining).toBe(0);
    expect(balance.cycleEndsAt).toBeNull();
  });

  it("consumes quota credits before free credits", async () => {
    const { user } = await userWithActiveSubscription(2);
    const submission = await createSubmissionRow(user.id);

    const result = await consumeCredit(user.id, submission.id);
    expect(result.from).toBe("quota");

    const balance = await getBalance(user.id);
    expect(balance.quotaRemaining).toBe(1);
    expect(balance.freeRemaining).toBe(3);
  });

  it("falls back to free credits when quota is exhausted", async () => {
    const { user } = await userWithActiveSubscription(1);
    const first = await createSubmissionRow(user.id);
    const second = await createSubmissionRow(user.id);

    await consumeCredit(user.id, first.id);
    const result = await consumeCredit(user.id, second.id);
    expect(result.from).toBe("free");

    const balance = await getBalance(user.id);
    expect(balance.quotaRemaining).toBe(0);
    expect(balance.freeRemaining).toBe(2);
  });

  it("never over-consumes under concurrency", async () => {
    const user = await createUser(); // 3 créditos grátis
    const submissions = await Promise.all(
      Array.from({ length: 6 }, () => createSubmissionRow(user.id)),
    );

    const outcomes = await Promise.allSettled(
      submissions.map((submission) => consumeCredit(user.id, submission.id)),
    );
    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(3);
    for (const outcome of rejected) {
      expect((outcome as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientCreditsError);
    }
    expect((await getBalance(user.id)).freeRemaining).toBe(0);
  });

  it("refunds at most once per submission", async () => {
    const user = await createUser();
    const submission = await createSubmissionRow(user.id);
    await consumeCredit(user.id, submission.id);
    expect((await getBalance(user.id)).freeRemaining).toBe(2);

    await refundCredit(user.id, submission.id);
    await refundCredit(user.id, submission.id); // repetido — idempotente
    expect((await getBalance(user.id)).freeRemaining).toBe(3);
  });

  it("ignores refund without a matching consume", async () => {
    const user = await createUser();
    const submission = await createSubmissionRow(user.id);
    await refundCredit(user.id, submission.id);
    expect((await getBalance(user.id)).freeRemaining).toBe(3);
  });

  it("nets unused quota to zero at cycle expiry without touching free credits", async () => {
    const { user, cycleId } = await userWithActiveSubscription(5);
    const submission = await createSubmissionRow(user.id);
    await consumeCredit(user.id, submission.id);

    await expireQuota(user.id, cycleId);

    const cycleSum = await prisma.creditTransaction.aggregate({
      _sum: { amount: true },
      where: { userId: user.id, cycleId },
    });
    expect(cycleSum._sum.amount).toBe(0);
    expect((await getBalance(user.id)).freeRemaining).toBe(3);
  });
});
