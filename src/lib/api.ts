import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { logger } from "@/lib/logger";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "EMAIL_NOT_VERIFIED"
  | "FORBIDDEN"
  | "PAYWALL"
  | "PREMIUM_REQUIRED"
  | "DUPLICATE_IMAGE"
  | "INVALID_STATE"
  | "VALIDATION_ERROR"
  | "EMAIL_IN_USE"
  | "TOKEN_EXPIRED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "THEME_NOT_ACTIVE"
  | "ALREADY_ENTERED"
  | "NO_ACTIVE_THEME"
  | "ACTIVE_THEME_EXISTS"
  | "ALREADY_CLOSED"
  | "DISPLAY_AS_REQUIRED"
  | "INTERNAL";

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function errorResponse(code: ErrorCode, status: number, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

type RouteContext<P> = { params: Promise<P> };

export function handleRoute<P = Record<string, never>>(
  handler: (request: Request, context: RouteContext<P>) => Promise<Response>,
) {
  return async (request: Request, context: RouteContext<P>): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse(error.code, error.status, error.message, error.details);
      }
      if (error instanceof ZodError) {
        return errorResponse(
          "VALIDATION_ERROR",
          400,
          "Dados inválidos.",
          error.flatten().fieldErrors,
        );
      }
      logger.error("unhandled_route_error", {
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse("INTERNAL", 500, "Erro interno. Tente novamente.");
    }
  };
}

// IP de origem do comprador para o campo `remoteIp` do Asaas (antifraude). O
// Asaas exige o IP do cliente final, nunca o do servidor — por isso lemos os
// cabeçalhos do proxy. Retorna null quando indisponível (ex.: ambiente local).
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return request.headers.get("x-real-ip");
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR", 400, "Corpo da requisição deve ser JSON.");
  }
  return schema.parse(raw);
}
