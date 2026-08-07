import { notFound } from "next/navigation";
import { getUserDetail } from "@/modules/admin";
import { CreditGrantForm } from "./CreditGrantForm";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "Processando",
  transcribing: "Lendo o texto",
  awaiting_review: "Aguardando revisão",
  grading: "Em correção",
  completed: "Corrigida",
  failed: "Falhou",
  expired: "Expirada",
};

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

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) {
    notFound();
  }

  const { user, submissions, creditBalance, creditTransactions, subscription, auditHistory } =
    detail;

  return (
    <>
      <h1>{user.name}</h1>
      <p className="muted">{user.email}</p>
      <section>
        <h2>Conta</h2>
        <p>
          <strong>Cadastro:</strong> {new Date(user.createdAt).toLocaleDateString("pt-BR")}
        </p>
        <p>
          <strong>E-mail verificado:</strong>{" "}
          {user.emailVerifiedAt ? (
            <span className="badge success">
              Sim, em {new Date(user.emailVerifiedAt).toLocaleDateString("pt-BR")}
            </span>
          ) : (
            <span className="badge warning">Não</span>
          )}
        </p>
        <p>
          <strong>Papel:</strong> {user.role === "admin" ? "Administrador" : "Usuário"}
        </p>
      </section>

      <section>
        <h2>Assinatura</h2>
        {subscription ? (
          <p>
            <strong>{TIER_LABELS[subscription.tier] ?? subscription.tier}</strong> —{" "}
            {SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status} — vigência até{" "}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}
          </p>
        ) : (
          <p className="muted">Sem assinatura.</p>
        )}
      </section>

      <section>
        <h2>Créditos</h2>
        <p>
          <strong>Saldo gratuito:</strong> {creditBalance.freeRemaining} —{" "}
          <strong>Saldo de cota:</strong> {creditBalance.quotaRemaining}
        </p>
        {creditTransactions.length === 0 ? (
          <p className="muted">Nenhuma movimentação de créditos.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {creditTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{new Date(transaction.createdAt).toLocaleString("pt-BR")}</td>
                    <td>{transaction.kind}</td>
                    <td>
                      {transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <CreditGrantForm userId={user.id} />
      </section>

      <section>
        <h2>Redações</h2>
        {submissions.length === 0 ? (
          <p className="muted">Nenhuma redação enviada.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tema</th>
                  <th>Status</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td>{new Date(submission.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td>{submission.themeText}</td>
                    <td>{STATUS_LABELS[submission.status] ?? submission.status}</td>
                    <td>{submission.totalScore ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Histórico de ações administrativas</h2>
        {auditHistory.length === 0 ? (
          <p className="muted">Nenhuma ação administrativa registrada.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Ação</th>
                  <th>Quantidade</th>
                  <th>Motivo</th>
                  <th>Administrador</th>
                </tr>
              </thead>
              <tbody>
                {auditHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.createdAt).toLocaleString("pt-BR")}</td>
                    <td>{entry.action}</td>
                    <td>{entry.amount ?? "—"}</td>
                    <td>{entry.reason ?? "—"}</td>
                    <td>{entry.adminEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
