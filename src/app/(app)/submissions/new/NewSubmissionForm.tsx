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
}

const ALLOWED_TYPES = ["image/jpeg", "image/png"];

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function NewSubmissionForm({ themes, maxUploadBytes }: Props) {
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
      setError("Escolha a foto da redação.");
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Formato não suportado. Envie uma foto JPEG ou PNG.");
      return;
    }
    if (file.size > maxUploadBytes) {
      setError(`A imagem excede o limite de ${limitMb} MB.`);
      return;
    }
    const selectedTheme = themes.find((theme) => theme.id === themeId);
    if (!selectedTheme && !themeText.trim()) {
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
          themeId: selectedTheme?.id,
          themeText: selectedTheme?.title ?? themeText.trim(),
          imageSha256,
          contentType: file.type,
          sizeBytes: file.size,
          force,
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
        throw new Error("Falha ao enviar a imagem. Tente novamente.");
      }

      setPhase("extracting");
      const uploadedResponse = await fetch(`/api/submissions/${submissionId}/uploaded`, {
        method: "POST",
      });
      if (!uploadedResponse.ok) {
        const body = await uploadedResponse.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Falha ao processar a imagem.");
      }
      const { status } = await uploadedResponse.json();
      if (status === "awaiting_review") {
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
      <label htmlFor="photo">Foto da redação (JPEG ou PNG, até {limitMb} MB)</label>
      <input id="photo" ref={fileRef} type="file" accept="image/jpeg,image/png" required />

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

      {error && <p className="error">{error}</p>}

      {duplicateWarning && (
        <div className="banner">
          <p>Esta foto parece já ter sido enviada. Quer enviar mesmo assim?</p>
          <button type="button" onClick={() => void submit(true)}>
            Enviar mesmo assim
          </button>{" "}
          <button type="button" className="secondary" onClick={() => setDuplicateWarning(false)}>
            Cancelar
          </button>
        </div>
      )}

      <p>
        <button type="submit" disabled={phase !== "idle"}>
          {phase === "idle"
            ? "Enviar redação"
            : phase === "uploading"
              ? "Enviando foto..."
              : "Lendo o texto da foto..."}
        </button>
      </p>
      <p className="muted">Após o envio, você revisa o texto extraído antes de usar 1 crédito.</p>
    </form>
  );
}
