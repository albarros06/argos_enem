import { getAppMetrics } from "@/modules/weekly";

export const dynamic = "force-dynamic";

const TIER_LABELS: Record<string, string> = {
  free: "Gratuito",
  entry: "Essencial",
  premium: "Premium",
};

export default async function AdminMetricsPage() {
  const metrics = await getAppMetrics();

  return (
    <>
      <h1>Métricas gerais</h1>
      <section>
        <p>
          <strong>Usuários cadastrados:</strong> {metrics.totalUsers}
        </p>
        <p>
          <strong>Submissões realizadas:</strong> {metrics.totalSubmissions}
        </p>
      </section>
      <section>
        <h2>Usuários por plano</h2>
        <table>
          <thead>
            <tr>
              <th>Plano</th>
              <th>Usuários</th>
            </tr>
          </thead>
          <tbody>
            {metrics.usersByPlan.map((plan) => (
              <tr key={plan.tier}>
                <td>{TIER_LABELS[plan.tier] ?? plan.tier}</td>
                <td>{plan.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
