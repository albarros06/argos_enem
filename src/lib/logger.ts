type Level = "info" | "warn" | "error";

function write(level: Level, message: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, fields?: Record<string, unknown>) => write("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write("error", message, fields),

  // Wraps an external vendor call, logging duration and outcome (R10).
  async vendorCall<T>(vendor: string, operation: string, fn: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await fn();
      write("info", "vendor_call", { vendor, operation, ms: Date.now() - startedAt, ok: true });
      return result;
    } catch (error) {
      write("error", "vendor_call", {
        vendor,
        operation,
        ms: Date.now() - startedAt,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};
