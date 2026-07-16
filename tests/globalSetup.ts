import { execSync } from "node:child_process";
import { resolveTestDatabaseUrl } from "./testDatabase";

// Aplica o schema no Postgres de teste (docker compose up -d postgres-test)
// antes de qualquer arquivo de teste rodar. Este é o primeiro ponto que toca o
// banco, então a validação de host precisa acontecer aqui — antes do migrate.
export default function setup() {
  const databaseUrl = resolveTestDatabaseUrl();
  execSync("node_modules/.bin/prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}
