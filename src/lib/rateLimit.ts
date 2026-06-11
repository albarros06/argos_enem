import { ApiError } from "@/lib/api";

// In-memory sliding window — sufficient for a single-process deployment (R6).
const globalForRateLimit = globalThis as unknown as { rateBuckets?: Map<string, number[]> };

export function assertRateLimit(key: string, maxHits: number, windowMs: number) {
  globalForRateLimit.rateBuckets ??= new Map();
  const buckets = globalForRateLimit.rateBuckets;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((time) => now - time < windowMs);
  if (hits.length >= maxHits) {
    throw new ApiError("RATE_LIMITED", 429, "Muitas tentativas. Aguarde um instante.");
  }
  hits.push(now);
  buckets.set(key, hits);
}
