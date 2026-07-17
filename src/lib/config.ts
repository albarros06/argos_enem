import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  ANTHROPIC_API_KEY: z.string().default(""),
  GOOGLE_APPLICATION_CREDENTIALS_JSON: z.string().default(""),
  // Vertex AI (grading via Gemini). Região us-central1: gemini-2.5-pro não é
  // servido em southamerica-east1, então a residência em SP foi trocada por
  // us-central1 (processamento transitório nos EUA — ver spec FR-011). O
  // projeto, quando vazio, é derivado do project_id da credencial de serviço.
  GOOGLE_CLOUD_LOCATION: z.string().default("us-central1"),
  GOOGLE_CLOUD_PROJECT: z.string().default(""),
  R2_ENDPOINT: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET: z.string().default("argos-essays"),
  ASAAS_API_KEY: z.string().default(""),
  ASAAS_API_URL: z.string().default("https://api-sandbox.asaas.com/v3"),
  ASAAS_WEBHOOK_TOKEN: z.string().default(""),
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("Argos <onboarding@resend.dev>"),
  FAKE_VENDORS: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

// Business levers, env-overridable without a deploy (R11). Plan prices/quotas are seed data.
export const business = {
  freeSignupCredits: intFromEnv("FREE_SIGNUP_CREDITS", 3),
  ocrMinMeanConfidence: floatFromEnv("OCR_MIN_MEAN_CONFIDENCE", 0.6),
  minEssayLines: intFromEnv("MIN_ESSAY_LINES", 7),
  maxUploadBytes: intFromEnv("MAX_UPLOAD_BYTES", 10 * 1024 * 1024),
  confirmLengthRatioMin: floatFromEnv("CONFIRM_LENGTH_RATIO_MIN", 0.5),
  confirmLengthRatioMax: floatFromEnv("CONFIRM_LENGTH_RATIO_MAX", 2),
  gracePeriodDays: intFromEnv("GRACE_PERIOD_DAYS", 7),
  abandonedSweepHours: intFromEnv("ABANDONED_SWEEP_HOURS", 24),
  // Provider é selecionado pelo prefixo do id (gemini-* -> Gemini, claude-* -> Anthropic).
  gradingModelId: process.env.GRADING_MODEL_ID ?? "gemini-3.1-pro-preview",
  // OCR de imagens: gemini-* usa transcrição por LLM (ignora linhas/numeração do
  // papel); qualquer outro valor (ex.: "google-vision") mantém o Vision. PDFs
  // continuam sempre no Vision (batchAnnotateFiles) por causa da contagem de páginas.
  // Padrão revertido para Vision: a transcrição LLM roda inline no /uploaded e
  // estourava o timeout da função (essay OCR síncrono). Reabilitar só quando o OCR
  // for assíncrono; até lá: IMAGE_OCR_MODEL_ID=gemini-3-flash-preview para testar.
  imageOcrModelId: process.env.IMAGE_OCR_MODEL_ID ?? "google-vision",
  imageOcrMaxOutputTokens: intFromEnv("IMAGE_OCR_MAX_OUTPUT_TOKENS", 4096),
  // Teto de saída do grading. Modelos com "thinking" (Gemini 3) consomem parte do
  // orçamento pensando; suba este valor se vir respostas vazias/truncadas.
  gradingMaxOutputTokens: intFromEnv("GRADING_MAX_OUTPUT_TOKENS", 8192),
  allowedUploadTypes: ["image/jpeg", "image/png", "application/pdf"],
  verificationTokenTtlHours: 24,
  resetTokenTtlHours: 2,
};

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  return raw ? parseInt(raw, 10) : fallback;
}

function floatFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  return raw ? parseFloat(raw) : fallback;
}

let cachedEnv: Env | null = null;

export function env(): Env {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}

export function fakeVendorsEnabled(): boolean {
  return env().FAKE_VENDORS === "1";
}
