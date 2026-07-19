import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getParticipationHistory } from "@/modules/weekly";

export const dynamic = "force-dynamic";

export default async function WeeklyHistoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { entries } = await getParticipationHistory(session.user.id);

  return (
    <>
      <h1>Histórico de redações da semana</h1>
      <p>
        <Link href="/redacoes-semana">← Tema da semana</Link>
      </p>
      {entries.length === 0 ? (
        <p className="muted">Você ainda não participou de nenhum tema encerrado.</p>
      ) : (
        <>
          <table className="table-responsive">
            <thead>
              <tr>
                <th>Tema</th>
                <th>Encerrado em</th>
                <th>Nota</th>
                <th>Posição final</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.themeId}>
                  <td>{entry.themeTitle}</td>
                  <td>
                    {entry.closedAt ? new Date(entry.closedAt).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td>{entry.totalScore ?? "—"}</td>
                  <td>
                    {entry.finalRank}º de {entry.totalParticipants}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-cards">
            {entries.map((entry) => (
              <div key={entry.themeId} className="table-card">
                <div className="table-card-row">
                  <span className="table-card-label">Tema</span>
                  <span>{entry.themeTitle}</span>
                </div>
                <div className="table-card-row">
                  <span className="table-card-label">Encerrado em</span>
                  <span>
                    {entry.closedAt ? new Date(entry.closedAt).toLocaleDateString("pt-BR") : "—"}
                  </span>
                </div>
                <div className="table-card-row">
                  <span className="table-card-label">Nota</span>
                  <span>{entry.totalScore ?? "—"}</span>
                </div>
                <div className="table-card-row">
                  <span className="table-card-label">Posição final</span>
                  <span>
                    {entry.finalRank}º de {entry.totalParticipants}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
