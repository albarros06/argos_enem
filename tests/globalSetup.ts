import { execSync } from "node:child_process";
import { assertLocalDatabaseUrl, resolveTestDatabaseUrl } from "./testDatabase";

// Aplica o schema no Postgres de teste (docker compose up -d postgres-test)
// antes de qualquer arquivo de teste rodar. Este é o primeiro ponto que toca o
// banco, então a validação de host precisa acontecer aqui — antes do migrate.
export default function setup() {
  const databaseUrl = resolveTestDatabaseUrl();

  // schema.prisma usa `directUrl` para migrations, e o CLI do Prisma carrega o
  // .env por conta própria. Sem passar DIRECT_URL explicitamente, o migrate roda
  // contra o DIRECT_URL de produção mesmo com DATABASE_URL apontando para o
  // banco local. Um valor já definido no ambiente ainda é validado.
  const directUrl = process.env.DIRECT_URL
    ? assertLocalDatabaseUrl(process.env.DIRECT_URL, "DIRECT_URL")
    : databaseUrl;

  execSync("node_modules/.bin/prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: directUrl },
    stdio: "inherit",
  });
}
