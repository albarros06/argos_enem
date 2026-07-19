import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/modules/dashboard";
import Card from "@/components/Card/Card";
import Badge from "@/components/Badge/Badge";
import Button from "@/components/Button/Button";
import styles from "./dashboard.module.css";

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
        <h1 className={styles.title}>Seu progresso</h1>
        <Card>
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>Você ainda não tem redações corrigidas.</p>
            <Link href="/submissions/new">
              <Button variant="primary" size="lg">
                Enviar minha primeira redação
              </Button>
            </Link>
          </div>
        </Card>
      </>
    );
  }

  const sorted = [...competencies].sort((a, b) => a.average - b.average);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  return (
    <>
      <h1 className={styles.title}>Seu progresso</h1>
      <p className={styles.subtitle}>
        {submissionCount} {submissionCount > 1 ? "redações" : "redação"} corrigida
        {submissionCount > 1 ? "s" : ""}
      </p>

      {submissionCount === 1 ? (
        <Card>
          <p className={styles.cardText}>
            Sua primeira correção é a linha de base: nota{" "}
            <strong>{scoreSeries[0].totalScore}</strong>. Envie mais redações para acompanhar sua
            evolução.
          </p>
        </Card>
      ) : (
        <Card>
          <h2 className={styles.chartTitle}>Evolução da nota total</h2>
          <ScoreChart series={scoreSeries.map((point) => point.totalScore)} />
        </Card>
      )}

      <h2 className={styles.sectionTitle}>Competências</h2>
      <p className={styles.competencyHint}>
        Ponto forte: <strong>{COMPETENCY_LABELS[strongest.competency]}</strong> · A melhorar:{" "}
        <strong>{COMPETENCY_LABELS[weakest.competency]}</strong>
      </p>
      <div className={styles.competencyGrid}>
        {competencies.map((competency) => (
          <Card key={competency.competency}>
            <div className={styles.competencyCard}>
              <div className={styles.competencyHeader}>
                <strong>
                  C{competency.competency} — {COMPETENCY_LABELS[competency.competency]}
                </strong>
                <div className={styles.badges}>
                  {competency.competency === weakest.competency && (
                    <Badge variant="warning">a melhorar</Badge>
                  )}
                  {competency.competency === strongest.competency && (
                    <Badge variant="success">ponto forte</Badge>
                  )}
                </div>
              </div>
              <p className={styles.competencyStats}>
                Última: <strong>{competency.latest}</strong> · Média: {competency.average} ·{" "}
                {TREND_LABELS[competency.trend]}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Correções anteriores</h2>
      <ul className={styles.submissionList}>
        {[...scoreSeries].reverse().map((point) => (
          <li key={point.submissionId} className={styles.submissionItem}>
            <Link href={`/submissions/${point.submissionId}`} className={styles.submissionLink}>
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
      className={styles.chart}
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
