import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/modules/dashboard";

const COMPETENCY_LABELS: Record<number, string> = {
  1: "Norma culta",
  2: "Compreensão do tema",
  3: "Argumentação",
  4: "Coesão",
  5: "Proposta de intervenção",
};

const TREND_LABELS = { up: "▲ subindo", down: "▼ caindo", stable: "— estável" } as const;

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const { scoreSeries, competencies, submissionCount } = await getDashboard(user.id);

  if (submissionCount === 0) {
    return (
      <>
        <h1>Seu progresso</h1>
        <div className="card">
          <p>Você ainda não tem redações corrigidas.</p>
          <p>
            <Link className="button" href="/submissions/new">
              Enviar minha primeira redação
            </Link>
          </p>
        </div>
      </>
    );
  }

  const sorted = [...competencies].sort((a, b) => a.average - b.average);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  return (
    <>
      <h1>Seu progresso</h1>
      <p className="muted">
        {submissionCount} redação{submissionCount > 1 ? "ões" : ""} corrigida
        {submissionCount > 1 ? "s" : ""}
      </p>

      {submissionCount === 1 ? (
        <div className="card">
          <p>
            Sua primeira correção é a linha de base: nota{" "}
            <strong>{scoreSeries[0].totalScore}</strong>. Envie mais redações para acompanhar sua
            evolução.
          </p>
        </div>
      ) : (
        <div className="card">
          <h2>Evolução da nota total</h2>
          <ScoreChart series={scoreSeries.map((point) => point.totalScore)} />
        </div>
      )}

      <h2>Competências</h2>
      <p className="muted">
        Ponto forte: <strong>{COMPETENCY_LABELS[strongest.competency]}</strong> · A melhorar:{" "}
        <strong>{COMPETENCY_LABELS[weakest.competency]}</strong>
      </p>
      {competencies.map((competency) => (
        <div className="card" key={competency.competency}>
          <strong>
            C{competency.competency} — {COMPETENCY_LABELS[competency.competency]}
          </strong>
          {competency.competency === weakest.competency && (
            <span className="badge warning"> a melhorar</span>
          )}
          {competency.competency === strongest.competency && (
            <span className="badge success"> ponto forte</span>
          )}
          <p>
            Última: <strong>{competency.latest}</strong> · Média: {competency.average} ·{" "}
            {TREND_LABELS[competency.trend]}
          </p>
        </div>
      ))}

      <h2>Correções anteriores</h2>
      <ul>
        {[...scoreSeries].reverse().map((point) => (
          <li key={point.submissionId}>
            <Link href={`/submissions/${point.submissionId}`}>
              {new Date(point.date).toLocaleDateString("pt-BR")} — nota {point.totalScore}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

// Gráfico de linha simples em SVG — sem dependência de biblioteca de gráficos.
function ScoreChart({ series }: { series: number[] }) {
  const width = 600;
  const height = 180;
  const padding = 24;
  const step = (width - 2 * padding) / Math.max(series.length - 1, 1);
  const y = (score: number) => height - padding - (score / 1000) * (height - 2 * padding);
  const points = series.map((score, index) => `${padding + index * step},${y(score)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Evolução da nota total"
      style={{ width: "100%", height: "auto" }}
    >
      <line x1={padding} y1={y(0)} x2={width - padding} y2={y(0)} stroke="#e2e8f0" />
      <line x1={padding} y1={y(500)} x2={width - padding} y2={y(500)} stroke="#e2e8f0" />
      <line x1={padding} y1={y(1000)} x2={width - padding} y2={y(1000)} stroke="#e2e8f0" />
      <text x={2} y={y(1000) + 4} fontSize="10" fill="#64748b">
        1000
      </text>
      <text x={2} y={y(500) + 4} fontSize="10" fill="#64748b">
        500
      </text>
      <polyline points={points} fill="none" stroke="#1d4ed8" strokeWidth="2" />
      {series.map((score, index) => (
        <circle key={index} cx={padding + index * step} cy={y(score)} r="3" fill="#1d4ed8" />
      ))}
    </svg>
  );
}
