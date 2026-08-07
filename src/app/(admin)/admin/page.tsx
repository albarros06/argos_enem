import {
  getGrowthSnapshot,
  getPipelineHealth,
  getRevenueSummary,
  type WindowedCounts,
} from "@/modules/admin";

export const dynamic = "force-dynamic";

const TIER_LABELS: Record<string, string> = {
  entry: "Essencial",
  premium: "Premium",
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  past_due: "Em atraso",
  canceled: "Cancelada",
  expired: "Expirada",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "Cartão",
  pix: "Pix",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  failed: "Falhou",
  refunded: "Reembolsado",
};

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  pending: "Processando",
  transcribing: "Lendo o texto",
  awaiting_review: "Aguardando revisão",
  grading: "Em correção",
  completed: "Corrigida",
  failed: "Falhou",
  expired: "Expirada",
};

const FAILURE_REASON_LABELS: Record<string, string> = {
  extraction_failed: "Falha na extração",
  insufficient_text: "Texto insuficiente",
  multi_page_pdf: "PDF com múltiplas páginas",
  grading_failed: "Falha na correção",
};

const ZERO_REASON_LABELS: Record<string, string> = {
  insufficient_text: "Texto insuficiente",
  genre_disregard: "Fuga ao gênero",
  theme_disconnection: "Fuga ao tema",
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function WindowedCountsRow({ label, counts }: { label: string; counts: WindowedCounts }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{counts.last24h}</td>
      <td>{counts.last7d}</td>
      <td>{counts.last30d}</td>
      <td>{counts.allTime}</td>
    </tr>
  );
}

export default async function AdminOverviewPage() {
  const [revenue, pipeline, growth] = await Promise.all([
    getRevenueSummary(),
    getPipelineHealth(),
    getGrowthSnapshot(),
  ]);

  return (
    <>
      <h1>Painel</h1>

      <section>
        <h2>Receita e assinaturas</h2>
        <p>
          <strong>MRR estimado:</strong> {formatCents(revenue.mrrCents)}
        </p>
        {revenue.subscribersByTierAndStatus.length === 0 ? (
          <p className="muted">Nenhuma assinatura registrada.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Assinantes</th>
                </tr>
              </thead>
              <tbody>
                {revenue.subscribersByTierAndStatus.map((group) => (
                  <tr key={`${group.tier}-${group.status}`}>
                    <td>{TIER_LABELS[group.tier] ?? group.tier}</td>
                    <td>{SUBSCRIPTION_STATUS_LABELS[group.status] ?? group.status}</td>
                    <td>{group.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3>Pagamentos recentes</h3>
        {revenue.recentPayments.length === 0 ? (
          <p className="muted">Nenhum pagamento registrado.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Usuário</th>
                  <th>Valor</th>
                  <th>Método</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {revenue.recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.createdAt).toLocaleString("pt-BR")}</td>
                    <td>{payment.userEmail ?? "—"}</td>
                    <td>{formatCents(payment.amountCents)}</td>
                    <td>{PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}</td>
                    <td>{PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Pipeline de submissões</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Submissões</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.statusCounts.map((entry) => (
                <tr key={entry.status}>
                  <td>{SUBMISSION_STATUS_LABELS[entry.status] ?? entry.status}</td>
                  <td>{entry.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Motivos de falha</h3>
        {pipeline.failureReasonCounts.length === 0 ? (
          <p className="muted">Nenhuma falha registrada.</p>
        ) : (
          <ul>
            {pipeline.failureReasonCounts.map((entry) => (
              <li key={entry.reason}>
                {FAILURE_REASON_LABELS[entry.reason] ?? entry.reason}: {entry.count}
              </li>
            ))}
          </ul>
        )}

        <h3>Motivos de nota zero</h3>
        {pipeline.zeroReasonCounts.length === 0 ? (
          <p className="muted">Nenhuma nota zero registrada.</p>
        ) : (
          <ul>
            {pipeline.zeroReasonCounts.map((entry) => (
              <li key={entry.reason}>
                {ZERO_REASON_LABELS[entry.reason] ?? entry.reason}: {entry.count}
              </li>
            ))}
          </ul>
        )}

        <h3>Distribuição de notas</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {pipeline.scoreDistribution.map((bucket) => (
                  <th key={bucket.bucketStart}>{bucket.bucketStart}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {pipeline.scoreDistribution.map((bucket) => (
                  <td key={bucket.bucketStart}>{bucket.count}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Crescimento</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>24h</th>
                <th>7d</th>
                <th>30d</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <WindowedCountsRow label="Cadastros" counts={growth.signups} />
              <WindowedCountsRow label="Submissões" counts={growth.submissions} />
              <WindowedCountsRow label="Verificações de e-mail" counts={growth.verifications} />
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
