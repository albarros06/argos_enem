import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// Janela deslizante persistida no Postgres (SEC-004). O Map em memória anterior
// era por-instância e reiniciava a cada cold start, sendo inócuo no modelo
// serverless distribuído da Vercel. Aqui a contagem é compartilhada entre todas
// as instâncias. A verificação e a inserção não são atômicas, o que é aceitável
// para rate limiting (deixar passar poucas tentativas sob corrida não é crítico,
// ao contrário do débito de créditos).
export async function assertRateLimit(key: string, maxHits: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs);

  // Remove tentativas expiradas desta chave — mantém a tabela limitada sem
  // depender só da varredura do cron.
  await prisma.rateLimitHit.deleteMany({ where: { key, createdAt: { lt: since } } });

  const hits = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  if (hits >= maxHits) {
    throw new ApiError("RATE_LIMITED", 429, "Muitas tentativas. Aguarde um instante.");
  }

  await prisma.rateLimitHit.create({ data: { key } });
}

// Remove tentativas antigas — chamado pela varredura do cron para conter o
// crescimento de chaves que não recebem novas tentativas (a maior janela é de
// minutos, então 24h é folga de sobra). Retorna quantas linhas removeu.
export async function sweepRateLimitHits(maxAgeMs = 86_400_000): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const { count } = await prisma.rateLimitHit.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
