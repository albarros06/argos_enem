import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { business } from "@/lib/config";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { grantSignupCredits } from "@/modules/credits";
import { consumeToken, issueToken } from "./tokens";

// Política de senha (SEC-007): mínimo de 10 caracteres e rejeição de padrões
// triviais (apenas dígitos ou um único caractere repetido). Aplicada só no
// cadastro e na redefinição — não no login — para não travar usuários
// existentes com senhas antigas. A senha fraca "senha123" (8 chars) é barrada
// pelo comprimento mínimo.
export const passwordSchema = z
  .string()
  .min(10, "A senha deve ter pelo menos 10 caracteres.")
  .refine(
    (value) => !/^\d+$/.test(value) && !/^(.)\1+$/.test(value),
    "Escolha uma senha mais forte (evite apenas números ou caracteres repetidos).",
  );

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: passwordSchema,
});

export async function registerUser(input: z.infer<typeof registerSchema>) {
  const { name, email, password } = registerSchema.parse(input);
  const passwordHash = await bcrypt.hash(password, 10);

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name, email, passwordHash } });
      await grantSignupCredits(created.id, tx);
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError("EMAIL_IN_USE", 409, "Este e-mail já está cadastrado.");
    }
    throw error;
  }

  await issueAndSendVerification(user.id, user.email);
  logger.info("user_registered", { userId: user.id });
  return { id: user.id, email: user.email };
}

async function issueAndSendVerification(userId: string, email: string) {
  const token = await issueToken(userId, "verify_email", business.verificationTokenTtlHours);
  await sendVerificationEmail(email, token);
}

export async function verifyEmail(rawToken: string) {
  const token = await consumeToken(rawToken, "verify_email");
  await prisma.user.update({
    where: { id: token.userId },
    data: { emailVerifiedAt: new Date() },
  });
}

export async function resendVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (user && !user.emailVerifiedAt && !user.deletedAt) {
    await issueAndSendVerification(user.id, user.email);
  }
  // Always succeeds outwardly — no account enumeration.
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (user && !user.deletedAt) {
    const token = await issueToken(user.id, "reset_password", business.resetTokenTtlHours);
    await sendPasswordResetEmail(user.email, token);
  }
}

export async function resetPassword(rawToken: string, newPassword: string) {
  passwordSchema.parse(newPassword);
  const token = await consumeToken(rawToken, "reset_password");
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: token.userId }, data: { passwordHash } });
}

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.deletedAt) {
    return null;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? { id: user.id, email: user.email, name: user.name } : null;
}
