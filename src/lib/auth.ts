import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { User } from "@prisma/client";
import { env } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { assertRateLimit } from "@/lib/rateLimit";
import { verifyCredentials } from "@/modules/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env().AUTH_SECRET,
  // Hospedado na Vercel; o host canônico é controlado por APP_URL, então o
  // header Host é confiável (trustHost). Links absolutos (reset/verificação de
  // e-mail) DEVEM ser derivados de APP_URL, nunca do host da requisição.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").toLowerCase();
        // Throttle de brute-force por conta (SEC-001): 5 tentativas / 5 min por
        // e-mail, na janela compartilhada do Postgres. Bloqueia adivinhação de
        // senha no endpoint que antes não tinha limite algum.
        await assertRateLimit(`login:${email}`, 5, 300_000);
        const user = await verifyCredentials(
          email,
          String(credentials?.password ?? ""),
        );
        return user ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});

export async function requireUser(): Promise<User> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new ApiError("UNAUTHENTICATED", 401, "Faça login para continuar.");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    throw new ApiError("UNAUTHENTICATED", 401, "Faça login para continuar.");
  }
  return user;
}

export async function requireVerifiedUser(
  message = "Confirme seu e-mail antes de enviar uma redação.",
): Promise<User> {
  const user = await requireUser();
  if (!user.emailVerifiedAt) {
    throw new ApiError("EMAIL_NOT_VERIFIED", 403, message);
  }
  return user;
}

// Gate do painel administrativo (/admin e /api/admin). Sessão sem role de
// administrador é rejeitada (FR-001).
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new ApiError("FORBIDDEN", 403, "Acesso restrito a administradores.");
  }
  return user;
}
