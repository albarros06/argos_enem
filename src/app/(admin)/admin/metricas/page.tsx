import { redirect } from "next/navigation";

// Página antiga (/admin/metricas) substituída pelo novo painel em /admin —
// mantida como redirect para não quebrar links salvos (contracts/api.md).
export default function AdminMetricsPage() {
  redirect("/admin");
}
