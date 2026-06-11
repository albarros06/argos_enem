import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { User } from "@prisma/client";
import { env } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { verifyCredentials } from "@/modules/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env().AUTH_SECRET,
  // Servidor Linux próprio atrás de proxy reverso (não Vercel): o host canônico
  // é controlado por APP_URL, então o header Host é confiável.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const user = await verifyCredentials(
          String(credentials?.email ?? ""),
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

export async function requireVerifiedUser(): Promise<User> {
  const user = await requireUser();
  if (!user.emailVerifiedAt) {
    throw new ApiError(
      "EMAIL_NOT_VERIFIED",
      403,
      "Confirme seu e-mail antes de enviar uma redação.",
    );
  }
  return user;
}
