import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, parseBody } from "@/lib/api";
import { requireUser, requireVerifiedUser } from "@/lib/auth";
import { createSubmission, createSubmissionSchema, listSubmissions } from "@/modules/submissions";
import { listActivePlans } from "@/modules/billing";

export const POST = handleRoute(async (request) => {
  const user = await requireVerifiedUser();
  const input = await parseBody(request, createSubmissionSchema);
  try {
    const result = await createSubmission(user.id, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError && error.code === "PAYWALL") {
      // O corpo do paywall inclui os planos disponíveis (FR-021).
      error.details = { plans: await listActivePlans() };
    }
    throw error;
  }
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export const GET = handleRoute(async (request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const { page } = listQuerySchema.parse({ page: url.searchParams.get("page") ?? undefined });
  return NextResponse.json(await listSubmissions(user.id, page));
});
