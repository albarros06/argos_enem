// Inicializa os timers de varredura no boot do servidor (R6).
//
// Na Vercel (serverless) não há processo de vida longa que segure um
// setInterval — a função congela após responder. Lá as varreduras rodam pelo
// Vercel Cron (vercel.json → /api/cron/sweep). Só ligamos os timers fora da
// Vercel (dev local / self-hosted em processo persistente).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { startSubmissionSweep } = await import("@/modules/submissions/sweep");
    const { startBillingSweep } = await import("@/modules/billing/cycles");
    const { startWeeklyThemeSweep } = await import("@/modules/weekly");
    startSubmissionSweep();
    startBillingSweep();
    startWeeklyThemeSweep();
  }
}
