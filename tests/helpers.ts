import { prisma } from "@/lib/prisma";
import { registerUser } from "@/modules/auth";

type FakeGlobals = {
  fakeGradingQueue?: unknown[];
  fakeTranscriptionQueue?: unknown[];
  fakeOutbox?: unknown[];
  fakeObjects?: Map<string, Buffer>;
  rateBuckets?: Map<string, number[]>;
  __testUserId?: string | null;
};

const fakeGlobals = globalThis as unknown as FakeGlobals;

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "User", "AuthToken", "Submission", "Transcription", "Evaluation",
     "Annotation", "CreditTransaction", "SubscriptionPlan", "Subscription",
     "PaymentTransaction", "EssayTheme", "WebhookEvent" CASCADE`,
  );
  fakeGlobals.fakeGradingQueue = [];
  fakeGlobals.fakeTranscriptionQueue = [];
  fakeGlobals.fakeOutbox = [];
  fakeGlobals.fakeObjects = new Map();
  fakeGlobals.rateBuckets = new Map();
  fakeGlobals.__testUserId = null;
}

// Autentica as rotas nos testes de integração: o mock de next-auth (vi.mock em
// cada arquivo) lê este valor para montar a sessão.
export function actAs(userId: string | null): void {
  fakeGlobals.__testUserId = userId;
}

export async function createUser(options?: { verified?: boolean; email?: string }) {
  const email = options?.email ?? `aluno${Date.now()}${Math.floor(Math.random() * 1e6)}@teste.com`;
  const { id } = await registerUser({ name: "Aluno Teste", email, password: "senha-segura" });
  if (options?.verified !== false) {
    await prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
  }
  return prisma.user.findUniqueOrThrow({ where: { id } });
}

export async function seedPlans() {
  const entry = await prisma.subscriptionPlan.create({
    data: { tier: "entry", name: "Plano Essencial", priceCents: 2990, monthlyQuota: 12 },
  });
  const premium = await prisma.subscriptionPlan.create({
    data: { tier: "premium", name: "Plano Premium", priceCents: 4990, monthlyQuota: 30 },
  });
  return { entry, premium };
}

// Linhas mínimas para satisfazer FKs do ledger em testes de crédito.
export async function createSubmissionRow(userId: string, status = "grading" as const) {
  return prisma.submission.create({
    data: {
      userId,
      themeText: "Tema de teste",
      imageSha256: Math.random().toString(16).slice(2).padEnd(64, "0"),
      status,
    },
  });
}

export function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost:3000${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function routeContext<P>(params: P): { params: Promise<P> } {
  return { params: Promise.resolve(params) };
}
