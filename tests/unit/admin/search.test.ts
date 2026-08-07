import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { searchUsers } from "@/modules/admin/search";
import { createUser, resetDb } from "../../helpers";

describe("admin searchUsers", () => {
  beforeEach(resetDb);

  it("matches on exact email", async () => {
    const user = await createUser({ email: "aluno.exato@teste.com" });
    await createUser({ email: "outro@teste.com" });

    const results = await searchUsers("aluno.exato@teste.com");
    expect(results.map((r) => r.id)).toEqual([user.id]);
  });

  it("matches partially and case-insensitively", async () => {
    const user = await createUser({ email: "Maria.Silva@Teste.com" });

    const results = await searchUsers("maria.silva");
    expect(results.map((r) => r.id)).toEqual([user.id]);
  });

  it("caps results at 20", async () => {
    for (let i = 0; i < 25; i++) {
      await createUser({ email: `busca${i}@teste.com` });
    }

    const results = await searchUsers("busca");
    expect(results).toHaveLength(20);
  });

  it("excludes soft-deleted users", async () => {
    const user = await createUser({ email: "apagado@teste.com" });
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

    expect(await searchUsers("apagado")).toEqual([]);
  });

  it("returns no results for an empty query", async () => {
    await createUser({ email: "qualquer@teste.com" });
    expect(await searchUsers("")).toEqual([]);
    expect(await searchUsers("   ")).toEqual([]);
  });
});
