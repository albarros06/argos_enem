// resetDb() (tests/helpers.ts) roda TRUNCATE em todas as tabelas e o globalSetup
// roda `prisma migrate deploy`. O .env de desenvolvimento aponta DATABASE_URL e
// DIRECT_URL para o Postgres de produção, e o CLI do Prisma carrega o .env
// sozinho — então qualquer uma das duas variáveis escapando para os testes
// atinge produção. Só hosts locais são aceitos.

export const DEFAULT_TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/argos_test";

// URL.hostname devolve IPv6 entre colchetes ("[::1]"), não "::1".
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

export function assertLocalDatabaseUrl(url: string, varName: string): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`${varName} não é uma URL válida: ${url}`);
  }

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `Os testes truncam todas as tabelas e aplicam migrations; só podem rodar contra ` +
        `um Postgres local.\n` +
        `${varName} aponta para o host remoto "${hostname}".\n\n` +
        `Rode "docker compose up -d postgres-test" e deixe ${varName} indefinida, ` +
        `ou aponte-a para ${DEFAULT_TEST_DATABASE_URL}.`,
    );
  }

  return url;
}

export function resolveTestDatabaseUrl(): string {
  return assertLocalDatabaseUrl(
    process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL,
    "DATABASE_URL",
  );
}
