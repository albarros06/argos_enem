// Inicializa os timers de varredura no boot do servidor (R6).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSubmissionSweep } = await import("@/modules/submissions/sweep");
    const { startBillingSweep } = await import("@/modules/billing/cycles");
    startSubmissionSweep();
    startBillingSweep();
  }
}
