import { beforeEach, describe, expect, it } from "vitest";
import { listActionsForUser, recordAdminAction } from "@/modules/admin/auditLog";
import { createAdmin, createUser, resetDb } from "../../helpers";

describe("admin auditLog", () => {
  beforeEach(resetDb);

  it("records an action then lists it with the correct fields", async () => {
    const admin = await createAdmin();
    const target = await createUser();

    await recordAdminAction(admin.id, "credit_grant", target.id, 5, "Reembolso — ticket #1");

    const entries = await listActionsForUser(target.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: "credit_grant",
      amount: 5,
      reason: "Reembolso — ticket #1",
      adminEmail: admin.email,
    });
    expect(entries[0].createdAt).toBeInstanceOf(Date);
  });

  it("returns an empty array for a user with no admin actions", async () => {
    const user = await createUser();
    expect(await listActionsForUser(user.id)).toEqual([]);
  });
});
