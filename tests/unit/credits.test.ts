import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  consumeCredit,
  cycleIdFor,
  expireQuota,
  freeCycleId,
  getBalance,
  grantManualCredits,
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

  it("grants 1 free credit at signup, scoped to the current calendar month", async () => {
    const user = await createUser();
    const balance = await getBalance(user.id);
    expect(balance.freeRemaining).toBe(1);
    expect(balance.quotaRemaining).toBe(0);
    expect(balance.cycleEndsAt).toBeNull();

    const grant = await prisma.creditTransaction.findFirst({
      where: { userId: user.id, kind: "monthly_free_grant" },
    });
    expect(grant?.cycleId).toBe(freeCycleId());
  });

  it("consumes quota credits before free credits", async () => {
    const { user } = await userWithActiveSubscription(2);
    const submission = await createSubmissionRow(user.id);

    const result = await consumeCredit(user.id, submission.id);
    expect(result.from).toBe("quota");

    const balance = await getBalance(user.id);
    expect(balance.quotaRemaining).toBe(1);
    expect(balance.freeRemaining).toBe(1);
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
    expect(balance.freeRemaining).toBe(0);
  });

  it("never over-consumes under concurrency", async () => {
    const user = await createUser(); // 1 crédito grátis do mês
    const submissions = await Promise.all(
      Array.from({ length: 4 }, () => createSubmissionRow(user.id)),
    );

    const outcomes = await Promise.allSettled(
      submissions.map((submission) => consumeCredit(user.id, submission.id)),
    );
    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

    expect(fulfilled).toHaveLength(1);
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
    expect((await getBalance(user.id)).freeRemaining).toBe(0);

    await refundCredit(user.id, submission.id);
    await refundCredit(user.id, submission.id); // repetido — idempotente
    expect((await getBalance(user.id)).freeRemaining).toBe(1);
  });

  it("ignores refund without a matching consume", async () => {
    const user = await createUser();
    const submission = await createSubmissionRow(user.id);
    await refundCredit(user.id, submission.id);
    expect((await getBalance(user.id)).freeRemaining).toBe(1);
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
    expect((await getBalance(user.id)).freeRemaining).toBe(1);
  });

  it("does not carry over free-credit usage from a previous calendar month", async () => {
    const user = await createUser();
    // Simula um mês anterior totalmente consumido — não deve afetar o mês corrente.
    const pastCycleId = "free:2020-01";
    await prisma.creditTransaction.createMany({
      data: [
        { userId: user.id, amount: 1, kind: "monthly_free_grant", cycleId: pastCycleId },
        { userId: user.id, amount: -1, kind: "consume", cycleId: pastCycleId },
      ],
    });

    expect((await getBalance(user.id)).freeRemaining).toBe(1);
  });

  it("does not double-grant the monthly credit on repeated balance checks", async () => {
    const user = await createUser();
    await getBalance(user.id);
    await getBalance(user.id);
    const balance = await getBalance(user.id);
    expect(balance.freeRemaining).toBe(1);

    const grants = await prisma.creditTransaction.count({
      where: { userId: user.id, kind: "monthly_free_grant" },
    });
    expect(grants).toBe(1);
  });

  it("freeCycleId scopes to the calendar year-month in UTC", () => {
    expect(freeCycleId(new Date("2026-01-31T23:59:59.999Z"))).toBe("free:2026-01");
    expect(freeCycleId(new Date("2026-02-01T00:00:00.000Z"))).toBe("free:2026-02");
  });

  it("manual grants add on top of the monthly free credit and never expire across months", async () => {
    const user = await createUser();
    await grantManualCredits(user.id, 5);

    expect((await getBalance(user.id)).freeRemaining).toBe(6); // 1 monthly + 5 manual

    // Simula a virada de mês: só o crédito mensal fica preso ao mês antigo.
    await prisma.creditTransaction.updateMany({
      where: { userId: user.id, kind: "monthly_free_grant" },
      data: { cycleId: "free:2000-01" },
    });

    // 5 manual (sobrevive à virada) + 1 novo crédito mensal do ciclo atual.
    expect((await getBalance(user.id)).freeRemaining).toBe(6);
  });

  it("grantManualCredits accepts negative amounts as deductions", async () => {
    const user = await createUser();
    await grantManualCredits(user.id, 5);
    await grantManualCredits(user.id, -2);

    expect((await getBalance(user.id)).freeRemaining).toBe(4); // 1 monthly + 5 - 2 manual

    const deduction = await prisma.creditTransaction.findFirst({
      where: { userId: user.id, kind: "manual_grant", amount: -2 },
    });
    expect(deduction).not.toBeNull();
  });

  it("grantManualCredits still rejects a zero or non-integer amount", async () => {
    const user = await createUser();
    await expect(grantManualCredits(user.id, 0)).rejects.toThrow();
    await expect(grantManualCredits(user.id, 1.5)).rejects.toThrow();
  });

  it("consumes the expiring monthly credit before the non-expiring manual pool", async () => {
    const user = await createUser();
    await grantManualCredits(user.id, 2);
    const submission = await createSubmissionRow(user.id);

    await consumeCredit(user.id, submission.id);

    const consume = await prisma.creditTransaction.findFirstOrThrow({
      where: { userId: user.id, kind: "consume", submissionId: submission.id },
    });
    expect(consume.cycleId).toBe(freeCycleId()); // gastou o crédito do mês, não o manual
    expect((await getBalance(user.id)).freeRemaining).toBe(2); // manual intacto
  });
});
