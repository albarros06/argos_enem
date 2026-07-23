import Link from "next/link";
import { auth } from "@/lib/auth";
import { getActiveThemeView, getMyActiveEntryView } from "@/modules/weekly";
import { getActiveTier } from "@/modules/billing";
import { Countdown } from "./Countdown";

export const dynamic = "force-dynamic";

export default async function WeeklyThemePage() {
  const view = await getActiveThemeView();

  if (!view) {
    return (
      <>
        <h1>Redação da semana</h1>
        <p className="muted">Nenhum tema ativo no momento. Volte em breve!</p>
        <p>
          <Link href="/redacoes-semana/historico">Ver meu histórico de participações</Link>
        </p>
      </>
    );
  }

  const session = await auth();
  const myEntry = session?.user?.id ? await getMyActiveEntryView(session.user.id) : null;
  const tier = session?.user?.id ? await getActiveTier(session.user.id) : null;

  return (
    <>
      <h1>Redação da semana</h1>
      <h2>{view.theme.title}</h2>
      <p>
        <Countdown endsAt={new Date(view.theme.endsAt).toISOString()} />
      </p>

      {view.theme.contents.length > 0 && (
        <section>
          <h3>Textos de apoio</h3>
          {view.theme.contents.map((content) =>
            content.kind === "text" ? (
              <p key={content.id} style={{ whiteSpace: "pre-wrap" }}>
                {content.body}
              </p>
            ) : content.fileType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={content.id}
                src={content.fileUrl ?? ""}
                alt="Texto de apoio"
                style={{ maxWidth: "100%" }}
              />
            ) : (
              <p key={content.id}>
                <a href={content.fileUrl ?? "#"} target="_blank" rel="noreferrer">
                  Abrir documento de apoio (PDF)
                </a>
              </p>
            ),
          )}
        </section>
      )}

      <section>
        <h3>Sua participação</h3>
        {myEntry?.status === "ok" ? (
          <p className="banner">
            {myEntry.rank !== null
              ? `Sua posição: ${myEntry.rank}º de ${myEntry.totalParticipants} — nota ${myEntry.totalScore}.`
              : "Sua redação está sendo corrigida. Sua posição aparecerá quando a correção terminar."}
          </p>
        ) : tier === "premium" ? (
          <p>
            <Link className="button" href={`/submissions/new?weeklyThemeId=${view.theme.id}`}>
              Participar
            </Link>
          </p>
        ) : (
          <p className="muted">
            A participação é exclusiva para assinantes do plano premium.{" "}
            <Link href="/billing">Conheça os planos</Link>.
          </p>
        )}
      </section>

      <section>
        <h3>Ranking ({view.participantCount} participantes)</h3>
        {view.ranking.length === 0 ? (
          <p className="muted">Ainda não há redações corrigidas neste tema.</p>
        ) : (
          <>
            <table className="table-responsive">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Participante</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {view.ranking.map((row) => (
                  <tr key={row.rank}>
                    <td>{row.rank}</td>
                    <td>{row.displayName}</td>
                    <td>{row.totalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-cards">
              {view.ranking.map((row) => (
                <div key={row.rank} className="table-card">
                  <div className="table-card-row">
                    <span className="table-card-label">#</span>
                    <span>{row.rank}</span>
                  </div>
                  <div className="table-card-row">
                    <span className="table-card-label">Participante</span>
                    <span>{row.displayName}</span>
                  </div>
                  <div className="table-card-row">
                    <span className="table-card-label">Nota</span>
                    <span>{row.totalScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
