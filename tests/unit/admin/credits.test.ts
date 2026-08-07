import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { grantCreditAdjustment } from "@/modules/admin/credits";
import { createAdmin, createUser, resetDb } from "../../helpers";

describe("admin grantCreditAdjustment", () => {
  beforeEach(resetDb);

  it("grants a positive amount, updates the balance, and writes one audit row", async () => {
    const admin = await createAdmin();
    const user = await createUser();

    const result = await grantCreditAdjustment(admin.id, user.id, 5, "Reembolso — ticket #42");

    expect(result.balance.freeRemaining).toBeGreaterThanOrEqual(5);
    expect(result.auditEntry).toMatchObject({
      amount: 5,
      reason: "Reembolso — ticket #42",
      adminEmail: admin.email,
    });

    const rows = await prisma.adminActionLog.findMany({ where: { targetUserId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "credit_grant", amount: 5, adminId: admin.id });
  });

  it("deducts a negative amount and writes one audit row", async () => {
    const admin = await createAdmin();
    const user = await createUser();
    await grantCreditAdjustment(admin.id, user.id, 10, "saldo inicial");

    const result = await grantCreditAdjustment(admin.id, user.id, -3, "correção de saldo");

    expect(result.auditEntry.amount).toBe(-3);
    const rows = await prisma.adminActionLog.findMany({ where: { targetUserId: user.id } });
    expect(rows).toHaveLength(2);
  });

  it("rejects amount 0 without writing to either table", async () => {
    const admin = await createAdmin();
    const user = await createUser();

    await expect(grantCreditAdjustment(admin.id, user.id, 0, "motivo válido")).rejects.toThrow();

    expect(await prisma.adminActionLog.count({ where: { targetUserId: user.id } })).toBe(0);
    expect(
      await prisma.creditTransaction.count({ where: { userId: user.id, kind: "manual_grant" } }),
    ).toBe(0);
  });

  it("rejects an empty or whitespace reason without writing to either table", async () => {
    const admin = await createAdmin();
    const user = await createUser();

    await expect(grantCreditAdjustment(admin.id, user.id, 5, "")).rejects.toThrow();
    await expect(grantCreditAdjustment(admin.id, user.id, 5, "   ")).rejects.toThrow();

    expect(await prisma.adminActionLog.count({ where: { targetUserId: user.id } })).toBe(0);
    expect(
      await prisma.creditTransaction.count({ where: { userId: user.id, kind: "manual_grant" } }),
    ).toBe(0);
  });
});
