"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SubmissionView {
  status: string;
  transcription?: { rawText: string; meanConfidence: number };
  weekly?: { themeTitle: string; displayAs: "real" | "anonymous" } | null;
}

// Revisão da transcrição: o aluno corrige erros de OCR antes de confirmar.
// A confirmação consome 1 crédito e apaga a foto (clarificação 1, FR-008).
export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [working, setWorking] = useState(false);
  const [weekly, setWeekly] = useState<{ themeTitle: string } | null>(null);
  const [displayAs, setDisplayAs] = useState<"real" | "anonymous">("real");

  useEffect(() => {
    fetch(`/api/submissions/${id}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Submissão não encontrada.");
        }
        const submission: SubmissionView = await response.json();
        if (submission.status !== "awaiting_review") {
          router.replace(`/submissions/${id}`);
          return;
        }
        setText(submission.transcription?.rawText ?? "");
        setConfidence(submission.transcription?.meanConfidence ?? null);
        if (submission.weekly) {
          setWeekly({ themeTitle: submission.weekly.themeTitle });
          setDisplayAs(submission.weekly.displayAs);
        }
        setLoaded(true);
      })
      .catch((loadError) => setError(loadError.message));
  }, [id, router]);

  async function confirm() {
    setWorking(true);
    setError(null);
    const response = await fetch(`/api/submissions/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmedText: text,
        ...(weekly ? { weeklyDisplayAs: displayAs } : {}),
      }),
    });
    if (response.ok) {
      router.push(`/submissions/${id}`);
      return;
    }
    const body = await response.json().catch(() => null);
    setError(body?.error?.message ?? "Não foi possível confirmar o texto.");
    setWorking(false);
  }

  async function abandon() {
    if (
      !window.confirm("Descartar esta redação? O arquivo será apagado e nenhum crédito será usado.")
    ) {
      return;
    }
    setWorking(true);
    await fetch(`/api/submissions/${id}`, { method: "DELETE" });
    router.push("/submissions");
  }

  if (error && !loaded) {
    return (
      <>
        <h1>Revisar transcrição</h1>
        <p className="error">{error}</p>
      </>
    );
  }
  if (!loaded) {
    return <p className="muted">Carregando transcrição...</p>;
  }

  return (
    <>
      <h1>Revisar transcrição</h1>
      <p className="muted">
        Confira o texto extraído da sua redação e corrija apenas os erros de leitura — não reescreva
        a redação.
      </p>
      {confidence !== null && confidence < 0.8 && (
        <div className="banner">
          A leitura teve confiança moderada ({Math.round(confidence * 100)}%). Revise o
          texto com atenção antes de confirmar.
        </div>
      )}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={18}
        aria-label="Texto extraído da redação"
      />
      {weekly && (
        <fieldset>
          <legend>Redação da semana: {weekly.themeTitle}</legend>
          <p className="muted">Como você quer aparecer no ranking público?</p>
          <label>
            <input
              type="radio"
              name="displayAs"
              checked={displayAs === "real"}
              onChange={() => setDisplayAs("real")}
            />{" "}
            Com meu nome
          </label>
          <label>
            <input
              type="radio"
              name="displayAs"
              checked={displayAs === "anonymous"}
              onChange={() => setDisplayAs("anonymous")}
            />{" "}
            De forma anônima
          </label>
        </fieldset>
      )}
      {error && <p className="error">{error}</p>}
      <p>
        <button onClick={() => void confirm()} disabled={working}>
          {working ? "Confirmando..." : "Confirmar e corrigir (usa 1 crédito)"}
        </button>{" "}
        <button className="secondary" onClick={() => void abandon()} disabled={working}>
          Descartar
        </button>
      </p>
      <p className="muted">
        Ao confirmar, o arquivo original é apagado e a correção começa — leva de 1 a 3 minutos.
      </p>
    </>
  );
}
