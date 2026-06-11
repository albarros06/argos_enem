import crypto from "crypto";
import type { AuthTokenKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function issueToken(
  userId: string,
  kind: AuthTokenKind,
  ttlHours: number,
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.authToken.create({
    data: {
      userId,
      kind,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    },
  });
  return rawToken;
}

export async function consumeToken(rawToken: string, kind: AuthTokenKind) {
  const token = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!token || token.kind !== kind) {
    throw new ApiError("VALIDATION_ERROR", 400, "Link inválido.");
  }
  if (token.usedAt || token.expiresAt < new Date()) {
    throw new ApiError("TOKEN_EXPIRED", 410, "Este link expirou. Solicite um novo.");
  }
  await prisma.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  return token;
}
