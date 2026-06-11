import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { logger } from "@/lib/logger";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "EMAIL_NOT_VERIFIED"
  | "PAYWALL"
  | "DUPLICATE_IMAGE"
  | "INVALID_STATE"
  | "VALIDATION_ERROR"
  | "EMAIL_IN_USE"
  | "TOKEN_EXPIRED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
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

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR", 400, "Corpo da requisição deve ser JSON.");
  }
  return schema.parse(raw);
}
