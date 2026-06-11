import { execSync } from "node:child_process";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/argos_test";

// Garante schema e seed no Postgres de teste antes de subir o servidor dev.
export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  execSync("node_modules/.bin/prisma migrate deploy", { env, stdio: "inherit" });
  execSync("node_modules/.bin/tsx prisma/seed.ts", { env, stdio: "inherit" });
}
