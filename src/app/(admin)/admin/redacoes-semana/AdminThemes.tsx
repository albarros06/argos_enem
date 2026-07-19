"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ThemeRow {
  id: string;
  title: string;
  status: string;
  endsAt: string;
  participantCount: number;
}

interface ContentItem {
  id: string;
  kind: "text" | "file";
  body: string | null;
  fileType: "image" | "pdf" | null;
  fileUrl: string | null;
}

interface ActiveTheme {
  id: string;
  title: string;
  endsAt: string;
  contents: ContentItem[];
}

interface ThemeMetrics {
  participantCount: number;
  avgTotalScore: number;
  scoreDistribution: Record<string, Record<string, number>>;
}

const SCORE_BUCKETS = ["0", "40", "80", "120", "160", "200"];

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? "Ocorreu um erro. Tente novamente.";
}

export function AdminThemes({ themes, active }: { themes: ThemeRow[]; active: ActiveTheme | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [title, setTitle] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const [newEndsAt, setNewEndsAt] = useState("");
  const [textBody, setTextBody] = useState("");
  const [metrics, setMetrics] = useState<{ themeId: string; data: ThemeMetrics } | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    setWorking(true);
    try {
      await action();
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Erro inesperado.");
    } finally {
      setWorking(false);
    }
  }

  async function createTheme() {
    const response = await fetch("/api/admin/weekly-themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), durationDays }),
    });
    if (!response.ok) throw new Error(await readError(response));
    setTitle("");
  }

  async function patchActive(body: Record<string, unknown>) {
    if (!active) return;
    const response = await fetch(`/api/admin/weekly-themes/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await readError(response));
  }

  async function addText() {
    if (!active) return;
    const response = await fetch(`/api/admin/weekly-themes/${active.id}/contents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "text", body: textBody.trim(), displayOrder: 0 }),
    });
    if (!response.ok) throw new Error(await readError(response));
    setTextBody("");
  }

  async function uploadFile(file: File) {
    if (!active) return;
    const fileType = file.type === "application/pdf" ? "pdf" : "image";
    const presign = await fetch(`/api/admin/weekly-themes/${active.id}/content-upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileType, contentType: file.type, sizeBytes: file.size }),
    });
    if (!presign.ok) throw new Error(await readError(presign));
    const { contentId, uploadUrl } = await presign.json();
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!put.ok) throw new Error("Falha ao enviar o arquivo.");
    const register = await fetch(`/api/admin/weekly-themes/${active.id}/contents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "file", contentId, fileType, displayOrder: 0 }),
    });
    if (!register.ok) throw new Error(await readError(register));
  }

  async function deleteContent(contentId: string) {
    if (!active) return;
    const response = await fetch(`/api/admin/weekly-themes/${active.id}/contents/${contentId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(await readError(response));
  }

  async function loadMetrics(themeId: string) {
    setError(null);
    const response = await fetch(`/api/admin/weekly-themes/${themeId}/metrics`);
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    setMetrics({ themeId, data: await response.json() });
  }

  return (
    <>
      <h1>Redações da semana</h1>
      {error && <p className="error">{error}</p>}

      {active ? (
        <section>
          <h2>Tema ativo</h2>
          <p>
            <strong>{active.title}</strong>
          </p>
          <p className="muted">Encerra em {new Date(active.endsAt).toLocaleString("pt-BR")}</p>

          <div className="banner">
            <h3>Ciclo de vida</h3>
            <label htmlFor="newEndsAt">Novo prazo</label>
            <input
              id="newEndsAt"
              type="datetime-local"
              value={newEndsAt}
              onChange={(event) => setNewEndsAt(event.target.value)}
            />
            <p>
              <button
                className="button"
                disabled={working || !newEndsAt}
                onClick={() =>
                  void run(() => patchActive({ action: "extend", endsAt: new Date(newEndsAt) }))
                }
              >
                Estender prazo
              </button>{" "}
              <button
                className="button secondary"
                disabled={working}
                onClick={() => {
                  if (window.confirm("Encerrar o tema agora? O ranking público deixará de aparecer.")) {
                    void run(() => patchActive({ action: "close" }));
                  }
                }}
              >
                Encerrar agora
              </button>
            </p>
          </div>

          <h3>Textos de apoio</h3>
          {active.contents.length === 0 ? (
            <p className="muted">Nenhum material de apoio.</p>
          ) : (
            <ul>
              {active.contents.map((content) => (
                <li key={content.id}>
                  {content.kind === "text"
                    ? `Texto: ${content.body?.slice(0, 80)}…`
                    : `Arquivo (${content.fileType})`}{" "}
                  <button
                    className="button secondary"
                    disabled={working}
                    onClick={() => void run(() => deleteContent(content.id))}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label htmlFor="textBody">Adicionar texto de apoio</label>
          <textarea
            id="textBody"
            rows={4}
            value={textBody}
            onChange={(event) => setTextBody(event.target.value)}
          />
          <p>
            <button className="button" disabled={working || !textBody.trim()} onClick={() => void run(addText)}>
              Adicionar texto
            </button>
          </p>

          <label htmlFor="fileUpload">Adicionar arquivo (imagem ou PDF, até 20 MB)</label>
          <input
            id="fileUpload"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={working}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void run(() => uploadFile(file));
                event.target.value = "";
              }
            }}
          />
        </section>
      ) : (
        <section>
          <h2>Publicar novo tema</h2>
          <label htmlFor="title">Enunciado</label>
          <textarea
            id="title"
            rows={3}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label htmlFor="duration">Duração (dias)</label>
          <input
            id="duration"
            type="number"
            min={1}
            max={60}
            value={durationDays}
            onChange={(event) => setDurationDays(Number(event.target.value))}
          />
          <p>
            <button className="button" disabled={working || !title.trim()} onClick={() => void run(createTheme)}>
              Publicar tema
            </button>
          </p>
        </section>
      )}

      <section>
        <h2>Todos os temas</h2>
        <table>
          <thead>
            <tr>
              <th>Tema</th>
              <th>Status</th>
              <th>Prazo</th>
              <th>Participantes</th>
              <th>Métricas</th>
            </tr>
          </thead>
          <tbody>
            {themes.map((theme) => (
              <tr key={theme.id}>
                <td>{theme.title}</td>
                <td>{theme.status === "active" ? "Ativo" : "Encerrado"}</td>
                <td>{new Date(theme.endsAt).toLocaleDateString("pt-BR")}</td>
                <td>{theme.participantCount}</td>
                <td>
                  <button className="button secondary" onClick={() => void loadMetrics(theme.id)}>
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {metrics && (
        <section>
          <h2>Métricas do tema</h2>
          <p>
            <strong>Participantes avaliados:</strong> {metrics.data.participantCount} —{" "}
            <strong>Média:</strong> {metrics.data.avgTotalScore}
          </p>
          <table>
            <thead>
              <tr>
                <th>Competência</th>
                {SCORE_BUCKETS.map((bucket) => (
                  <th key={bucket}>{bucket}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((competency) => {
                const dist = metrics.data.scoreDistribution[`c${competency}`] ?? {};
                return (
                  <tr key={competency}>
                    <td>C{competency}</td>
                    {SCORE_BUCKETS.map((bucket) => (
                      <td key={bucket}>{dist[bucket] ?? 0}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
