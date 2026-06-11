import { Resend } from "resend";
import { env, fakeVendorsEnabled } from "@/lib/config";
import { logger } from "@/lib/logger";

export interface OutboxMessage {
  to: string;
  subject: string;
  url: string;
}

const globalForEmail = globalThis as unknown as { fakeOutbox?: OutboxMessage[] };

export function fakeOutbox(): OutboxMessage[] {
  globalForEmail.fakeOutbox ??= [];
  return globalForEmail.fakeOutbox;
}

async function send(to: string, subject: string, url: string, html: string) {
  // In dev/test the link is logged and captured instead of emailed (quickstart).
  if (fakeVendorsEnabled() || !env().RESEND_API_KEY) {
    logger.info("email_link", { to, subject, url });
    fakeOutbox().push({ to, subject, url });
    return;
  }
  const resend = new Resend(env().RESEND_API_KEY);
  await logger.vendorCall("resend", "send", () =>
    resend.emails.send({ from: env().EMAIL_FROM, to, subject, html }),
  );
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${env().APP_URL}/verify-email?token=${token}`;
  await send(
    to,
    "Confirme seu e-mail — Argos",
    url,
    `<p>Bem-vindo(a) ao Argos!</p>
     <p>Confirme seu e-mail para começar a enviar redações:</p>
     <p><a href="${url}">Confirmar e-mail</a></p>
     <p>O link expira em 24 horas.</p>`,
  );
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${env().APP_URL}/reset-password?token=${token}`;
  await send(
    to,
    "Redefinição de senha — Argos",
    url,
    `<p>Recebemos um pedido para redefinir sua senha.</p>
     <p><a href="${url}">Redefinir senha</a></p>
     <p>Se você não pediu a redefinição, ignore este e-mail. O link expira em 2 horas.</p>`,
  );
}
