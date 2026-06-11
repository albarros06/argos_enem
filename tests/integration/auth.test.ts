import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { fakeOutbox } from "@/lib/email";
import { ApiError } from "@/lib/api";
import {
  registerUser,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyCredentials,
  verifyEmail,
} from "@/modules/auth";
import { getBalance } from "@/modules/credits";
import { resetDb } from "../helpers";

function lastTokenFor(email: string): string {
  const message = [...fakeOutbox()].reverse().find((item) => item.to === email);
  expect(message, `nenhum e-mail enviado para ${email}`).toBeDefined();
  return new URL(message!.url).searchParams.get("token")!;
}

describe("auth flow", () => {
  beforeEach(resetDb);

  it("register → verify → login", async () => {
    await registerUser({ name: "Ana", email: "ana@teste.com", password: "senha-segura" });

    const created = await prisma.user.findUniqueOrThrow({ where: { email: "ana@teste.com" } });
    expect(created.emailVerifiedAt).toBeNull(); // submissão bloqueada até verificar (FR-001)
    expect((await getBalance(created.id)).freeRemaining).toBe(3); // FR-019

    await verifyEmail(lastTokenFor("ana@teste.com"));
    const verified = await prisma.user.findUniqueOrThrow({ where: { email: "ana@teste.com" } });
    expect(verified.emailVerifiedAt).not.toBeNull();

    const session = await verifyCredentials("ana@teste.com", "senha-segura");
    expect(session?.id).toBe(created.id);
    expect(await verifyCredentials("ana@teste.com", "senha-errada")).toBeNull();
  });

  it("rejects duplicate registration with EMAIL_IN_USE", async () => {
    await registerUser({ name: "Ana", email: "ana@teste.com", password: "senha-segura" });
    await expect(
      registerUser({ name: "Outra", email: "ana@teste.com", password: "outra-senha" }),
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE", status: 409 });
  });

  it("rejects a reused verification token with 410", async () => {
    await registerUser({ name: "Ana", email: "ana@teste.com", password: "senha-segura" });
    const token = lastTokenFor("ana@teste.com");
    await verifyEmail(token);

    try {
      await verifyEmail(token);
      expect.unreachable("token reutilizado deveria falhar");
    } catch (error) {
      expect((error as ApiError).code).toBe("TOKEN_EXPIRED");
      expect((error as ApiError).status).toBe(410);
    }
  });

  it("resends verification only for unverified accounts, without enumeration", async () => {
    await registerUser({ name: "Ana", email: "ana@teste.com", password: "senha-segura" });
    const sentBefore = fakeOutbox().length;

    await resendVerification("ana@teste.com");
    expect(fakeOutbox().length).toBe(sentBefore + 1);

    await resendVerification("nao-existe@teste.com"); // não vaza existência
    expect(fakeOutbox().length).toBe(sentBefore + 1);
  });

  it("resets the password via emailed token", async () => {
    await registerUser({ name: "Ana", email: "ana@teste.com", password: "senha-antiga" });

    await requestPasswordReset("ana@teste.com");
    await resetPassword(lastTokenFor("ana@teste.com"), "senha-nova-123");

    expect(await verifyCredentials("ana@teste.com", "senha-antiga")).toBeNull();
    expect(await verifyCredentials("ana@teste.com", "senha-nova-123")).not.toBeNull();
  });

  it("password reset request for unknown email sends nothing but does not fail", async () => {
    const sentBefore = fakeOutbox().length;
    await expect(requestPasswordReset("fantasma@teste.com")).resolves.toBeUndefined();
    expect(fakeOutbox().length).toBe(sentBefore);
  });
});
