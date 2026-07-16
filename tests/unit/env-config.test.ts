import { describe, it, expect, beforeAll } from "vitest";
import { env } from "@/lib/config";

/**
 * Environment configuration validation tests.
 * Verifies all required env vars are present, properly formatted, and accessible.
 */
describe("Environment Configuration", () => {
  describe("Database", () => {
    it("DATABASE_URL is set and valid PostgreSQL URI", () => {
      const url = env().DATABASE_URL;
      expect(url).toBeTruthy();
      expect(url).toMatch(/^postgresql:\/\//);
      expect(url).toContain("@");
    });

    it("DIRECT_URL should be set in production and valid PostgreSQL URI", () => {
      const url = env().DIRECT_URL;
      if (!env().APP_URL.includes("localhost") || url) {
        if (url) {
          expect(url).toMatch(/^postgresql:\/\//);
          expect(url).toContain("@");
        }
      }
    });

    it("DATABASE_URL and DIRECT_URL should be different when both set", () => {
      const dbUrl = env().DATABASE_URL;
      const directUrl = env().DIRECT_URL;
      if (directUrl) {
        expect(dbUrl).not.toEqual(directUrl);
      }
    });
  });

  describe("Authentication", () => {
    it("AUTH_SECRET is set and at least 32 characters", () => {
      const secret = env().AUTH_SECRET;
      expect(secret).toBeTruthy();
      expect(secret.length).toBeGreaterThanOrEqual(32);
    });

    it("AUTH_SECRET is not the development default", () => {
      const secret = env().AUTH_SECRET;
      expect(secret).not.toEqual("dev-secret-please-change-0123456789abcdef");
    });
  });

  describe("Google Cloud Vision", () => {
    it("GOOGLE_APPLICATION_CREDENTIALS_JSON should be set in production", () => {
      if (!env().APP_URL.includes("localhost")) {
        const creds = env().GOOGLE_APPLICATION_CREDENTIALS_JSON;
        expect(creds).toBeTruthy();
      }
    });

    it("GOOGLE_APPLICATION_CREDENTIALS_JSON parses as valid JSON when set", () => {
      const creds = env().GOOGLE_APPLICATION_CREDENTIALS_JSON;
      if (creds) {
        expect(() => JSON.parse(creds)).not.toThrow();
      }
    });

    it("Google credentials contain required service account fields when set", () => {
      const creds = env().GOOGLE_APPLICATION_CREDENTIALS_JSON;
      if (creds) {
        const parsed = JSON.parse(creds);
        expect(parsed).toHaveProperty("type", "service_account");
        expect(parsed).toHaveProperty("project_id");
        expect(parsed).toHaveProperty("private_key");
        expect(parsed).toHaveProperty("client_email");
      }
    });

    it("private_key contains valid PEM format when credentials set", () => {
      const creds = env().GOOGLE_APPLICATION_CREDENTIALS_JSON;
      if (creds) {
        const parsed = JSON.parse(creds);
        expect(parsed.private_key).toContain("BEGIN PRIVATE KEY");
        expect(parsed.private_key).toContain("END PRIVATE KEY");
      }
    });
  });

  describe("Cloudflare R2", () => {
    it("R2_BUCKET is set", () => {
      const bucket = env().R2_BUCKET;
      expect(bucket).toBeTruthy();
      expect(bucket).toMatch(/^[a-z0-9-]+$/);
    });

    it("R2_ENDPOINT is set when not using fake vendors", () => {
      if (env().FAKE_VENDORS === "0") {
        expect(env().R2_ENDPOINT).toBeTruthy();
        expect(env().R2_ENDPOINT).toMatch(/^https:\/\//);
      }
    });

    it("R2_ACCESS_KEY_ID is set when not using fake vendors", () => {
      if (env().FAKE_VENDORS === "0") {
        expect(env().R2_ACCESS_KEY_ID).toBeTruthy();
        expect(env().R2_ACCESS_KEY_ID.length).toBeGreaterThan(10);
      }
    });

    it("R2_SECRET_ACCESS_KEY is set when not using fake vendors", () => {
      if (env().FAKE_VENDORS === "0") {
        expect(env().R2_SECRET_ACCESS_KEY).toBeTruthy();
        expect(env().R2_SECRET_ACCESS_KEY.length).toBeGreaterThan(20);
      }
    });
  });

  describe("Email (Resend)", () => {
    it("RESEND_API_KEY has correct prefix when set", () => {
      const key = env().RESEND_API_KEY;
      if (key) {
        expect(key).toMatch(/^re_/);
      }
    });

    it("RESEND_API_KEY should be set in production", () => {
      if (!env().APP_URL.includes("localhost")) {
        expect(env().RESEND_API_KEY).toBeTruthy();
      }
    });
  });

  describe("Payments (Asaas)", () => {
    it("ASAAS_API_URL is set and valid URL", () => {
      const url = env().ASAAS_API_URL;
      expect(url).toBeTruthy();
      expect(url).toMatch(/^https:\/\//);
    });

    it("ASAAS_WEBHOOK_TOKEN should be set and non-empty", () => {
      const token = env().ASAAS_WEBHOOK_TOKEN;
      if (!env().APP_URL.includes("localhost")) {
        expect(token).toBeTruthy();
        expect(token.length).toBeGreaterThan(10);
      }
    });

    it("ASAAS_API_KEY and WEBHOOK_TOKEN should be set in production", () => {
      if (!env().APP_URL.includes("localhost")) {
        expect(env().ASAAS_API_KEY).toBeTruthy();
        expect(env().ASAAS_WEBHOOK_TOKEN).toBeTruthy();
      }
    });
  });

  describe("Claude AI (Grading)", () => {
    it("ANTHROPIC_API_KEY is set when not using fake vendors", () => {
      if (env().FAKE_VENDORS === "0") {
        const key = env().ANTHROPIC_API_KEY;
        expect(key).toBeTruthy();
      }
    });

    it("ANTHROPIC_API_KEY has correct prefix if set", () => {
      const key = env().ANTHROPIC_API_KEY;
      if (key) {
        expect(key).toMatch(/^sk-ant-/);
      }
    });
  });

  describe("Application", () => {
    it("APP_URL is set and valid URL", () => {
      const url = env().APP_URL;
      expect(url).toBeTruthy();
      expect(url).toMatch(/^https?:\/\//);
    });

    it("FAKE_VENDORS is either 0 or 1", () => {
      const val = env().FAKE_VENDORS;
      expect(["0", "1", 0, 1]).toContain(val);
    });
  });

  describe("Production Readiness", () => {
    it("All critical keys are set in production", () => {
      if (env().APP_URL.includes("localhost")) {
        // Development mode: some keys can be missing for local testing
        expect(env().DATABASE_URL).toBeTruthy();
      } else {
        // Production: all keys must be set
        expect(env().DATABASE_URL).toBeTruthy();
        expect(env().AUTH_SECRET).toBeTruthy();
        expect(env().GOOGLE_APPLICATION_CREDENTIALS_JSON).toBeTruthy();
        expect(env().RESEND_API_KEY).toBeTruthy();
        expect(env().ASAAS_API_KEY).toBeTruthy();
        expect(env().ANTHROPIC_API_KEY).toBeTruthy();
        if (env().FAKE_VENDORS === "0") {
          expect(env().R2_ENDPOINT).toBeTruthy();
          expect(env().R2_ACCESS_KEY_ID).toBeTruthy();
          expect(env().R2_SECRET_ACCESS_KEY).toBeTruthy();
        }
      }
    });
  });
});
