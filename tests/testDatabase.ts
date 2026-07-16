// resetDb() (tests/helpers.ts) roda TRUNCATE em todas as tabelas, e o .env de
// desenvolvimento aponta DATABASE_URL para o Postgres de produção. Como os testes
// respeitam um DATABASE_URL já presente no ambiente, um valor herdado apagaria
// produção. Só hosts locais são aceitos.

export const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/argos_test";

// URL.hostname devolve IPv6 entre colchetes ("[::1]"), não "::1".
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

export function resolveTestDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`DATABASE_URL não é uma URL válida: ${url}`);
  }

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `Os testes truncam todas as tabelas e só podem rodar contra um Postgres local.\n` +
        `DATABASE_URL aponta para o host remoto "${hostname}".\n\n` +
        `Rode "docker compose up -d postgres-test" e deixe DATABASE_URL indefinida, ` +
        `ou aponte-a para ${DEFAULT_TEST_DATABASE_URL}.`,
    );
  }

  return url;
}
