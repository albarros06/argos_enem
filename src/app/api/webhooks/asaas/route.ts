import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { errorResponse, handleRoute } from "@/lib/api";
import { processAsaasWebhook } from "@/modules/billing";
import type { AsaasWebhookBody } from "@/modules/billing/webhooks";

// Webhook do Asaas: valida o token compartilhado e processa de forma idempotente.
// Sempre responde 200 para entregas duplicadas (R4).
export const POST = handleRoute(async (request) => {
  const token = request.headers.get("asaas-access-token");
  if (!env().ASAAS_WEBHOOK_TOKEN || token !== env().ASAAS_WEBHOOK_TOKEN) {
    return errorResponse("UNAUTHENTICATED", 401, "Token de webhook inválido.");
  }
  const body = (await request.json()) as AsaasWebhookBody;
  if (!body?.event) {
    return errorResponse("VALIDATION_ERROR", 400, "Evento ausente.");
  }
  const result = await processAsaasWebhook(body);
  return NextResponse.json({ received: true, duplicate: result.duplicate });
});
