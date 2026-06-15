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
    <main>
      <h1>Histórico de redações da semana</h1>
      <p>
        <Link href="/redacoes-semana">← Tema da semana</Link>
      </p>
      {entries.length === 0 ? (
        <p className="muted">Você ainda não participou de nenhum tema encerrado.</p>
      ) : (
        <table>
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
                <td>{entry.closedAt ? new Date(entry.closedAt).toLocaleDateString("pt-BR") : "—"}</td>
                <td>{entry.totalScore ?? "—"}</td>
                <td>
                  {entry.finalRank}º de {entry.totalParticipants}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
