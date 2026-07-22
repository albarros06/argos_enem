import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRateLimitError, withRetry } from "@/lib/retry";

describe("isRateLimitError", () => {
  it("reconhece erro com status 429", () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
  });

  it("reconhece status 429 em instância de Error (APIError/ApiError)", () => {
    class FakeApiError extends Error {
      status = 429;
    }
    expect(isRateLimitError(new FakeApiError("rate limited"))).toBe(true);
  });

  it("rejeita outros códigos de status", () => {
    expect(isRateLimitError({ status: 500 })).toBe(false);
    expect(isRateLimitError({ status: 400 })).toBe(false);
  });

  it("rejeita valores sem campo status", () => {
    expect(isRateLimitError(new Error("falha genérica"))).toBe(false);
    expect(isRateLimitError({})).toBe(false);
  });

  it("rejeita valores não-objeto e nulos", () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError("429")).toBe(false);
    expect(isRateLimitError(429)).toBe(false);
  });
});

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolve no primeiro sucesso sem retentar", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { isRetryable: isRateLimitError });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retenta em erro retryable e eventualmente resolve", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { isRetryable: isRateLimitError });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("aplica backoff exponencial entre tentativas (1s, 2s, ...)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { isRetryable: isRateLimitError, attempts: 5 });

    // Ainda nenhum retry disparado: só a 1ª tentativa (síncrona) rodou.
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(1); // delay de 1s ainda não decorrido

    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2); // 1s decorrido -> 2ª tentativa

    await vi.advanceTimersByTimeAsync(1999);
    expect(fn).toHaveBeenCalledTimes(2); // delay de 2s ainda não decorrido

    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3); // 2s decorrido -> 3ª tentativa

    await expect(promise).resolves.toBe("ok");
  });

  it("não retenta erro não-retryable e propaga imediatamente", async () => {
    const authError = { status: 401 };
    const fn = vi.fn().mockRejectedValue(authError);

    await expect(withRetry(fn, { isRetryable: isRateLimitError })).rejects.toBe(authError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("propaga o erro após esgotar as tentativas configuradas", async () => {
    const rateLimitError = { status: 429 };
    const fn = vi.fn().mockRejectedValue(rateLimitError);

    const promise = withRetry(fn, { isRetryable: isRateLimitError, attempts: 3 });
    const assertion = expect(promise).rejects.toBe(rateLimitError);
    await vi.runAllTimersAsync();
    await assertion;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respeita attempts e baseDelayMs customizados", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 429 });

    const promise = withRetry(fn, {
      isRetryable: isRateLimitError,
      attempts: 2,
      baseDelayMs: 100,
    });
    const assertion = expect(promise).rejects.toEqual({ status: 429 });

    // 1ª tentativa síncrona, depois só 1 retry (attempts=2) após 100ms.
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    await assertion;
  });

  it("attempts=1 nunca retenta", async () => {
    const error = { status: 429 };
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { isRetryable: isRateLimitError, attempts: 1 })).rejects.toBe(
      error,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
