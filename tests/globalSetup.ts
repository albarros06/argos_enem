import { execSync } from "node:child_process";

// Aplica o schema no Postgres de teste (docker compose up -d postgres-test)
// antes de qualquer arquivo de teste rodar.
export default function setup() {
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/argos_test";
  execSync("node_modules/.bin/prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}
