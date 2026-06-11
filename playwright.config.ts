import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      FAKE_VENDORS: "1",
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/argos_test",
      AUTH_SECRET: "test-secret-test-secret-test-secret",
      APP_URL: "http://localhost:3000",
      ASAAS_WEBHOOK_TOKEN: "test-webhook-token",
    },
  },
});
