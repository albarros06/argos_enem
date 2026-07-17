import { after } from "next/server";
import { logger } from "@/lib/logger";
import { fakeVendorsEnabled } from "@/lib/config";

// Agenda trabalho fora do ciclo do request (OCR, correção). Em produção usa
// after() do Next: a plataforma mantém a função viva até a tarefa terminar, em
// vez de um fire-and-forget solto que pode ser morto assim que a resposta sai.
// Em testes/dev-fake roda in-process (o processo Node segue vivo), então os
// testes acompanham por polling. Erros nunca escapam sem log.
export function scheduleBackgroundTask(name: string, task: () => Promise<void>): void {
  const safe = () =>
    task().catch((error) => {
      logger.error("background_task_crashed", {
        task: name,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  if (fakeVendorsEnabled()) {
    void safe();
    return;
  }
  try {
    after(safe);
  } catch {
    // Fora de um escopo de request (scripts, cron): fire-and-forget direto.
    void safe();
  }
}
