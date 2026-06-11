"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnnotatedText, type AnnotationView } from "@/components/AnnotatedText";

interface CompetencyView {
  competency: number;
  score: number;
  justification: string;
}

interface SubmissionView {
  id: string;
  status: string;
  failureReason: string | null;
  themeText: string;
  createdAt: string;
  evaluation?: {
    totalScore: number;
    competencies: CompetencyView[];
    zeroReason: string | null;
    generalFeedback: string;
    confirmedText: string;
    annotations: AnnotationView[];
  };
}

const COMPETENCY_LABELS: Record<number, string> = {
  1: "Domínio da norma culta",
  2: "Compreensão do tema e do gênero",
  3: "Seleção e organização de argumentos",
  4: "Coesão e mecanismos linguísticos",
  5: "Proposta de intervenção",
};

const FAILURE_MESSAGES: Record<string, string> = {
  extraction_failed:
    "Não conseguimos ler o texto da foto. Tire uma nova foto com boa iluminação, papel plano e a folha inteira no enquadramento — nenhum crédito foi usado.",
  insufficient_text:
    "O texto identificado é curto demais para correção (mínimo de 7 linhas). Envie uma nova foto da redação completa — nenhum crédito foi usado.",
  grading_failed:
    "Houve uma falha na correção e seu crédito foi devolvido automaticamente. Envie a redação novamente.",
};

const ZERO_REASON_MESSAGES: Record<string, string> = {
  insufficient_text: "Texto insuficiente: a redação tem menos linhas que o mínimo exigido.",
  genre_disregard: "Desconsideração do gênero dissertativo-argumentativo exigido pelo ENEM.",
  theme_disconnection: "Fuga completa do tema proposto.",
};

const POLL_INTERVAL_MS = 3000;

export default function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [submission, setSubmission] = useState<SubmissionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/submissions/${id}`);
    if (!response.ok) {
      setError("Submissão não encontrada.");
      return null;
    }
    const view: SubmissionView = await response.json();
    setSubmission(view);
    return view;
  }, [id]);

  // Acompanhamento em tempo real por polling (R6): reagenda enquanto a
  // submissão estiver em processamento.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      const view = await load();
      if (!stopped && view && ["pending", "grading"].includes(view.status)) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };
    timer = setTimeout(poll, 0);
    return () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [load]);

  if (error) {
    return (
      <>
        <h1>Redação</h1>
        <p className="error">{error}</p>
      </>
    );
  }
  if (!submission) {
    return <p className="muted">Carregando...</p>;
  }

  if (submission.status === "awaiting_review") {
    return (
      <>
        <h1>{submission.themeText}</h1>
        <div className="banner">
          O texto extraído está pronto para sua revisão.{" "}
          <Link href={`/submissions/${submission.id}/review`}>Revisar agora</Link>
        </div>
      </>
    );
  }

  if (submission.status === "pending" || submission.status === "grading") {
    return (
      <>
        <h1>{submission.themeText}</h1>
        <div className="card">
          <p>
            {submission.status === "pending"
              ? "Processando a foto da sua redação..."
              : "Sua redação está sendo corrigida — isso leva de 1 a 3 minutos."}
          </p>
          <p className="muted">Esta página atualiza automaticamente.</p>
        </div>
      </>
    );
  }

  if (submission.status === "failed") {
    return (
      <>
        <h1>{submission.themeText}</h1>
        <p className="error">
          {FAILURE_MESSAGES[submission.failureReason ?? ""] ??
            "Houve uma falha no processamento. Tente novamente."}
        </p>
        <p>
          <Link className="button" href="/submissions/new">
            Enviar nova foto
          </Link>
        </p>
      </>
    );
  }

  if (submission.status === "expired") {
    return (
      <>
        <h1>{submission.themeText}</h1>
        <p>Esta submissão foi descartada antes da confirmação. Nenhum crédito foi usado.</p>
        <p>
          <Link className="button" href="/submissions/new">
            Enviar redação
          </Link>
        </p>
      </>
    );
  }

  const evaluation = submission.evaluation;
  if (!evaluation) {
    return <p className="muted">Carregando avaliação...</p>;
  }

  return (
    <>
      <h1>{submission.themeText}</h1>
      <p className="muted">
        Corrigida em {new Date(submission.createdAt).toLocaleDateString("pt-BR")}
      </p>

      <div className="card" style={{ textAlign: "center" }}>
        <p className="muted" style={{ margin: 0 }}>
          Nota total
        </p>
        <p style={{ fontSize: "2.5rem", fontWeight: 700, margin: 0 }}>{evaluation.totalScore}</p>
        <p className="muted" style={{ margin: 0 }}>
          de 1000
        </p>
      </div>

      {evaluation.zeroReason && (
        <div className="banner">
          <strong>Nota zero:</strong> {ZERO_REASON_MESSAGES[evaluation.zeroReason]}
        </div>
      )}

      <h2>Competências</h2>
      {evaluation.competencies.map((competency) => (
        <div className="card" key={competency.competency}>
          <strong>
            C{competency.competency} — {COMPETENCY_LABELS[competency.competency]}:{" "}
            {competency.score}/200
          </strong>
          <p>{competency.justification}</p>
        </div>
      ))}

      <h2>Seu texto com anotações</h2>
      <div className="card">
        <AnnotatedText text={evaluation.confirmedText} annotations={evaluation.annotations} />
      </div>

      <h2>Comentário geral</h2>
      <div className="card">
        <p>{evaluation.generalFeedback}</p>
      </div>

      <p>
        <Link className="button" href="/submissions/new">
          Enviar outra redação
        </Link>{" "}
        <Link className="button secondary" href="/dashboard">
          Ver meu progresso
        </Link>
      </p>
    </>
  );
}
