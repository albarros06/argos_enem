// Backoff exponencial para chamadas a LLM (Gemini via Vertex AI, Anthropic)
// que podem estourar cota momentaneamente (429). Ambos os SDKs expõem
// `status` no erro lançado (ApiError do @google/genai, APIError da
// Anthropic), então a detecção é a mesma para os dois providers. Erros que
// não são de rate limit (schema inválido, auth, etc.) nunca são retentados —
// tentar de novo não vai resolver e só atrasa a falha.
export function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 429
  );
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  isRetryable: (error: unknown) => boolean;
}

// 3 tentativas / 1s-2s-4s cabem com folga no maxDuration=60s das rotas que
// disparam grading e OCR em background (confirm, uploaded).
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === attempts || !options.isRetryable(error)) {
        throw error;
      }
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw new Error("unreachable");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
