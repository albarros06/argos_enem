import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { errorResponse, handleRoute } from "@/lib/api";
import { logger } from "@/lib/logger";
import { sweepBillingCycles } from "@/modules/billing";
import { sweepAbandonedSubmissions } from "@/modules/submissions";
import { closeExpiredThemes } from "@/modules/weekly";

// Varreduras de tempo executadas pelo Vercel Cron (vercel.json). Substituem os
// setInterval de instrumentation.ts, que não sobrevivem ao serverless. Sem
// processo persistente na Vercel, este endpoint é o "relógio" das transições
// que nenhum request de usuário nem webhook dispara.
export const maxDuration = 60;

// A Vercel injeta `Authorization: Bearer <CRON_SECRET>` nas chamadas agendadas
// quando CRON_SECRET está definido. Exigimos o segredo para bloquear disparos
// externos — sem ele configurado, o endpoint fica fechado.
export const POST = handleRoute(runSweeps);
export const GET = handleRoute(runSweeps);

async function runSweeps(request: Request): Promise<Response> {
  const secret = env().CRON_SECRET;
  const authorized =
    secret !== "" && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorized) {
    return errorResponse("UNAUTHENTICATED", 401, "Cron não autorizado.");
  }

  // As três varreduras são independentes — uma falha não deve impedir as outras.
  const [billing, submissions, themes] = await Promise.allSettled([
    sweepBillingCycles(),
    sweepAbandonedSubmissions(),
    closeExpiredThemes(),
  ]);

  for (const [name, result] of [
    ["billing", billing],
    ["submissions", submissions],
    ["themes", themes],
  ] as const) {
    if (result.status === "rejected") {
      logger.error("cron_sweep_failed", {
        sweep: name,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  const ok = [billing, submissions, themes].every((r) => r.status === "fulfilled");
  return NextResponse.json(
    {
      ok,
      billing: billing.status,
      submissions: submissions.status,
      themes: themes.status,
    },
    { status: ok ? 200 : 500 },
  );
}
