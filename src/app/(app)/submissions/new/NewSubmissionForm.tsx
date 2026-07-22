"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Theme {
  id: string;
  title: string;
  year: number | null;
}

interface Props {
  themes: Theme[];
  maxUploadBytes: number;
  weeklyTheme?: { id: string; title: string } | null;
  groupTheme?: { id: string; title: string } | null;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Aguarda o OCR (que roda em segundo plano) sair de pending/transcribing. Devolve
// o status terminal, ou "transcribing" se estourar o tempo de espera do cliente.
async function pollTranscription(submissionId: string): Promise<string> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const response = await fetch(`/api/submissions/${submissionId}`);
    if (response.ok) {
      const { status } = await response.json();
      if (status !== "pending" && status !== "transcribing") {
        return status;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return "transcribing";
}

export function NewSubmissionForm({ themes, maxUploadBytes, weeklyTheme, groupTheme }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [themeId, setThemeId] = useState("");
  const [themeText, setThemeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "extracting">("idle");
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const limitMb = Math.floor(maxUploadBytes / (1024 * 1024));

  async function submit(force: boolean) {
    setError(null);
    setDuplicateWarning(false);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Escolha a foto ou o PDF da redação.");
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Formato não suportado. Envie uma foto JPEG, PNG ou um arquivo PDF.");
      return;
    }
    if (file.size > maxUploadBytes) {
      setError(`O arquivo excede o limite de ${limitMb} MB.`);
      return;
    }
    const selectedTheme = themes.find((theme) => theme.id === themeId);
    if (!weeklyTheme && !groupTheme && !selectedTheme && !themeText.trim()) {
      setError("Escolha um tema do catálogo ou escreva o tema da proposta.");
      return;
    }

    setPhase("uploading");
    try {
      const imageSha256 = await sha256Hex(file);
      const createResponse = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeId: weeklyTheme || groupTheme ? undefined : selectedTheme?.id,
          themeText: weeklyTheme?.title ?? groupTheme?.title ?? selectedTheme?.title ?? themeText.trim(),
          imageSha256,
          contentType: file.type,
          sizeBytes: file.size,
          force,
          ...(weeklyTheme ? { weeklyThemeId: weeklyTheme.id } : {}),
          ...(groupTheme ? { groupThemeId: groupTheme.id } : {}),
        }),
      });
      if (createResponse.status === 402) {
        router.push("/billing");
        return;
      }
      if (createResponse.status === 409) {
        const body = await createResponse.json().catch(() => null);
        if (body?.error?.code === "DUPLICATE_IMAGE") {
          setDuplicateWarning(true);
          setPhase("idle");
          return;
        }
      }
      if (!createResponse.ok) {
        const body = await createResponse.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Não foi possível iniciar o envio.");
      }
      const { submissionId, uploadUrl } = await createResponse.json();

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error("Falha ao enviar o arquivo. Tente novamente.");
      }

      setPhase("extracting");
      const uploadedResponse = await fetch(`/api/submissions/${submissionId}/uploaded`, {
        method: "POST",
      });
      if (!uploadedResponse.ok) {
        const body = await uploadedResponse.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Falha ao processar o arquivo.");
      }

      // O OCR roda em segundo plano; acompanhamos a submissão até sair de
      // transcribing. Se demorar além do limite, mandamos para a página de
      // detalhe, que segue atualizando sozinha.
      const finalStatus = await pollTranscription(submissionId);
      if (finalStatus === "awaiting_review") {
        router.push(`/submissions/${submissionId}/review`);
      } else {
        router.push(`/submissions/${submissionId}`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro inesperado.");
      setPhase("idle");
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false);
      }}
    >
      <label htmlFor="photo">Redação (foto JPEG/PNG ou PDF, até {limitMb} MB)</label>
      <input
        id="photo"
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        required
      />

      {weeklyTheme ? (
        <div className="banner">
          <strong>Redação da semana</strong>
          <p>{weeklyTheme.title}</p>
        </div>
      ) : groupTheme ? (
        <div className="banner">
          <strong>Tema do grupo</strong>
          <p>{groupTheme.title}</p>
        </div>
      ) : (
        <>
          <label htmlFor="theme">Tema (provas anteriores do ENEM)</label>
          <select id="theme" value={themeId} onChange={(event) => setThemeId(event.target.value)}>
            <option value="">— Escrever tema livre —</option>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.year ? `${theme.year} — ` : ""}
                {theme.title}
              </option>
            ))}
          </select>

          {!themeId && (
            <>
              <label htmlFor="themeText">Tema livre</label>
              <input
                id="themeText"
                value={themeText}
                onChange={(event) => setThemeText(event.target.value)}
                placeholder="Digite o tema da proposta de redação"
                maxLength={500}
              />
            </>
          )}
        </>
      )}

      {error && <p className="error">{error}</p>}

      {duplicateWarning && (
        <div className="banner">
          <p>Este arquivo parece já ter sido enviado. Quer enviar mesmo assim?</p>
          <button type="button" className="button" onClick={() => void submit(true)}>
            Enviar mesmo assim
          </button>{" "}
          <button type="button" className="button secondary" onClick={() => setDuplicateWarning(false)}>
            Cancelar
          </button>
        </div>
      )}

      <p>
        <button type="submit" className="button" disabled={phase !== "idle"}>
          {phase === "idle"
            ? "Enviar redação"
            : phase === "uploading"
              ? "Enviando arquivo..."
              : "Lendo o texto da redação..."}
        </button>
      </p>
      <p className="muted">Após o envio, você revisa o texto extraído antes de usar 1 crédito.</p>
    </form>
  );
}
