import { resolveTestDatabaseUrl } from "./testDatabase";

process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret";
process.env.APP_URL ??= "http://localhost:3000";
process.env.FAKE_VENDORS = "1";
process.env.ASAAS_WEBHOOK_TOKEN ??= "test-webhook-token";
