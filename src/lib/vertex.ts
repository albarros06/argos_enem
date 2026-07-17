import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/config";

export interface VertexClientConfig {
  vertexai: true;
  project: string;
  location: string;
  googleAuthOptions: { credentials: Record<string, unknown> };
}

// Deriva a configuração do cliente Vertex AI a partir do ambiente. Falha com
// mensagem acionável quando falta credencial, o JSON é inválido, ou não há
// projeto (nem GOOGLE_CLOUD_PROJECT nem project_id na credencial).
// O projeto vem de GOOGLE_CLOUD_PROJECT ou, na ausência, do project_id da
// própria credencial de serviço (a mesma usada no OCR e no grading).
export function resolveVertexClientConfig(
  credentialsJson: string,
  projectOverride: string,
  location: string,
): VertexClientConfig {
  if (!credentialsJson) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON ausente: necessário para autenticar no Vertex AI.",
    );
  }
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON inválido: não é um JSON válido.");
  }
  const credentialProject =
    typeof credentials.project_id === "string" ? credentials.project_id : "";
  const project = projectOverride || credentialProject;
  if (!project) {
    throw new Error(
      "Projeto do Vertex AI indeterminado: defina GOOGLE_CLOUD_PROJECT ou inclua project_id na credencial de serviço.",
    );
  }
  return { vertexai: true, project, location, googleAuthOptions: { credentials } };
}

// Cliente Vertex AI compartilhado (grading e OCR via Gemini usam a mesma
// service account e região). Instanciado uma vez, sob demanda.
let cachedClient: GoogleGenAI | null = null;

export function vertexClient(): GoogleGenAI {
  if (!cachedClient) {
    cachedClient = new GoogleGenAI(
      resolveVertexClientConfig(
        env().GOOGLE_APPLICATION_CREDENTIALS_JSON,
        env().GOOGLE_CLOUD_PROJECT,
        env().GOOGLE_CLOUD_LOCATION,
      ),
    );
  }
  return cachedClient;
}
