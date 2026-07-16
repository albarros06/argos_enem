import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { confirmTranscription } from "@/modules/submissions";

const schema = z.object({
  confirmedText: z.string().min(1),
  weeklyDisplayAs: z.enum(["real", "anonymous"]).optional(),
});

export const POST = handleRoute<{ id: string }>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const { confirmedText, weeklyDisplayAs } = await parseBody(request, schema);
  const submission = await confirmTranscription(user.id, id, confirmedText, weeklyDisplayAs);
  return NextResponse.json({ status: submission.status });
});
