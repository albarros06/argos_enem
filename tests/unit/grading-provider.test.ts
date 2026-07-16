import { describe, expect, it } from "vitest";
import {
  gradingProvider,
  gradingProviderKind,
  resolveVertexClientConfig,
} from "@/modules/grading/llm";

// Credencial de serviço mínima no formato aceito por GOOGLE_APPLICATION_CREDENTIALS_JSON.
function fakeCredentials(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "service_account",
    project_id: "argos-prod",
    private_key: "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n",
    client_email: "ocr@argos-prod.iam.gserviceaccount.com",
    ...overrides,
  });
}

describe("gradingProviderKind (seleção de provider)", () => {
  it("usa o fake quando vendors falsos estão ativos, mesmo com modelo gemini", () => {
    expect(gradingProviderKind(true, "gemini-2.5-pro")).toBe("fake");
  });

  it("roteia modelos gemini-* para o Vertex AI", () => {
    expect(gradingProviderKind(false, "gemini-2.5-pro")).toBe("gemini");
    expect(gradingProviderKind(false, "gemini-3.1-pro")).toBe("gemini");
  });

  it("roteia modelos claude-* para a Anthropic", () => {
    expect(gradingProviderKind(false, "claude-sonnet-5")).toBe("anthropic");
  });
});

describe("resolveVertexClientConfig (autenticação Vertex AI)", () => {
  it("configura o cliente em modo Vertex com a credencial de serviço", () => {
    const config = resolveVertexClientConfig(fakeCredentials(), "", "us-central1");
    expect(config.vertexai).toBe(true);
    expect(config.location).toBe("us-central1");
    expect(config.googleAuthOptions.credentials).toMatchObject({ type: "service_account" });
  });

  it("deriva o projeto do project_id da credencial quando não há override", () => {
    const config = resolveVertexClientConfig(fakeCredentials(), "", "us-central1");
    expect(config.project).toBe("argos-prod");
  });

  it("prioriza GOOGLE_CLOUD_PROJECT sobre o project_id da credencial", () => {
    const config = resolveVertexClientConfig(fakeCredentials(), "argos-staging", "us-central1");
    expect(config.project).toBe("argos-staging");
  });

  it("falha com mensagem acionável quando a credencial está ausente (FR-008)", () => {
    expect(() => resolveVertexClientConfig("", "", "us-central1")).toThrow(
      /GOOGLE_APPLICATION_CREDENTIALS_JSON ausente/,
    );
  });

  it("falha quando a credencial não é JSON válido (FR-008)", () => {
    expect(() => resolveVertexClientConfig("{not json", "", "us-central1")).toThrow(/inválido/);
  });

  it("falha quando não há projeto derivável (FR-008)", () => {
    const noProject = JSON.stringify({ type: "service_account", client_email: "x@y.z" });
    expect(() => resolveVertexClientConfig(noProject, "", "us-central1")).toThrow(
      /Projeto do Vertex AI indeterminado/,
    );
  });
});

describe("gradingProvider (offline)", () => {
  it("usa o fake determinístico sem chamadas externas quando FAKE_VENDORS=1 (SC-005)", async () => {
    // tests/setup.ts define FAKE_VENDORS=1 para toda a suíte.
    const result = await gradingProvider().grade({
      theme: "Tema de teste",
      essayText: "Um texto de redação qualquer para avaliação determinística.",
    });
    expect(result.competencies).toHaveLength(5);
    expect(result.zeroReason).toBeNull();
  });
});
