import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { storage, fakeStorageHas } from "@/lib/storage";
import { runAccountDeletion, requestAccountDeletion } from "@/modules/auth/deletion";
import { createUser, resetDb, seedPlans } from "../helpers";

async function seedFullAccount() {
  const { entry } = await seedPlans();
  const user = await createUser();

  const submission = await prisma.submission.create({
    data: {
      userId: user.id,
      themeText: "Tema",
      imageSha256: "c".repeat(64),
      status: "completed",
    },
  });
  await prisma.transcription.create({
    data: { submissionId: submission.id, rawText: "texto", meanConfidence: 0.9 },
  });
  const evaluation = await prisma.evaluation.create({
    data: {
      submissionId: submission.id,
      scoreC1: 120,
      scoreC2: 120,
      scoreC3: 120,
      scoreC4: 120,
      scoreC5: 120,
      totalScore: 600,
      justifications: {},
      generalFeedback: "ok",
      rubricVersion: "test",
      modelId: "fake",
    },
  });
  await prisma.annotation.create({
    data: {
      evaluationId: evaluation.id,
      competency: 1,
      excerpt: "texto",
      anchored: true,
      issue: "x",
      suggestion: "y",
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: entry.id,
      asaasSubscriptionId: "sub_del",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.paymentTransaction.create({
    data: {
      userId: user.id,
      subscriptionId: subscription.id,
      asaasPaymentId: "pay_del",
      kind: "cycle",
      amountCents: 2990,
      method: "pix",
      status: "confirmed",
    },
  });

  // Imagem residual no storage (ex.: submissão pendente).
  const pending = await prisma.submission.create({
    data: {
      userId: user.id,
      themeText: "Pendente",
      imageSha256: "d".repeat(64),
      status: "pending",
      imageKey: `essays/${user.id}/pendente.jpg`,
    },
  });
  await storage().putObject(pending.imageKey!, Buffer.from("foto"), "image/jpeg");

  return { user, pendingImageKey: pending.imageKey! };
}

describe("LGPD account deletion (FR-028)", () => {
  beforeEach(resetDb);

  it("erases user data, deletes stored images, and anonymizes payments", async () => {
    const { user, pendingImageKey } = await seedFullAccount();

    await runAccountDeletion(user.id);

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.submission.count()).toBe(0);
    expect(await prisma.transcription.count()).toBe(0);
    expect(await prisma.evaluation.count()).toBe(0);
    expect(await prisma.annotation.count()).toBe(0);
    expect(await prisma.creditTransaction.count()).toBe(0);
    expect(await prisma.authToken.count()).toBe(0);
    expect(await prisma.subscription.count()).toBe(0);
    expect(fakeStorageHas(pendingImageKey)).toBe(false);

    // Retenção fiscal: o pagamento permanece, sem vínculo com o usuário.
    const payment = await prisma.paymentTransaction.findUniqueOrThrow({
      where: { asaasPaymentId: "pay_del" },
    });
    expect(payment.userId).toBeNull();
    expect(payment.amountCents).toBe(2990);
  });

  it("requestAccountDeletion revokes access immediately via deletedAt", async () => {
    const user = await createUser();
    await requestAccountDeletion(user.id);

    // O job assíncrono pode já ter concluído; em ambos os casos o acesso morreu.
    const remaining = await prisma.user.findUnique({ where: { id: user.id } });
    expect(remaining === null || remaining.deletedAt !== null).toBe(true);
  });
});
