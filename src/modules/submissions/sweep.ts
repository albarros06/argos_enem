import { prisma } from "@/lib/prisma";
import { business } from "@/lib/config";
import { logger } from "@/lib/logger";
import { storage } from "@/lib/storage";
import { deleteEntry } from "@/modules/weekly";

// Submissões paradas antes da confirmação por mais de 24h são expiradas e suas
// imagens apagadas (FR-027a, R5). Roda em timer iniciado em instrumentation.ts.
export async function sweepAbandonedSubmissions(): Promise<number> {
  const cutoff = new Date(Date.now() - business.abandonedSweepHours * 60 * 60 * 1000);
  const abandoned = await prisma.submission.findMany({
    where: { status: { in: ["pending", "awaiting_review"] }, updatedAt: { lt: cutoff } },
  });

  for (const submission of abandoned) {
    if (submission.imageKey) {
      try {
        await storage().deleteObject(submission.imageKey);
      } catch (error) {
        logger.warn("sweep_image_delete_failed", {
          submissionId: submission.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await deleteEntry(submission.id);
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: "expired", imageKey: null },
    });
  }

  if (abandoned.length > 0) {
    logger.info("sweep_expired_submissions", { count: abandoned.length });
  }
  return abandoned.length;
}

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export function startSubmissionSweep(): NodeJS.Timeout {
  const timer = setInterval(() => {
    sweepAbandonedSubmissions().catch((error) => {
      logger.error("submission_sweep_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}
