"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  publishedAt: string;
  contents: ContentItem[];
}

interface Member {
  userId: string;
  name: string;
  role: "leader" | "member";
  joinedAt: string | null;
}

interface RankingRow {
  rank: number;
  displayName: string;
  totalScore: number;
  submittedAt: string;
}

interface GroupView {
  group: {
    id: string;
    name: string;
    leaderId: string | null;
    leaderName: string | null;
    inviteCode: string;
    memberCount: number;
  };
  members: Member[];
  activeTheme: ActiveTheme | null;
  ranking: RankingRow[];
}

interface Props {
  groupId: string;
  view: GroupView;
  isLeader: boolean;
  currentUserId: string;
  hasEntryForActiveTheme: boolean;
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? "Ocorreu um erro. Tente novamente.";
}

export function GroupDetail({
  groupId,
  view,
  isLeader,
  currentUserId,
  hasEntryForActiveTheme,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [themeTitle, setThemeTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  const [copied, setCopied] = useState(false);

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/groups/join/${view.group.inviteCode}`
      : "";

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

  async function proposeTheme() {
    const response = await fetch(`/api/groups/${groupId}/themes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: themeTitle.trim() }),
    });
    if (!response.ok) throw new Error(await readError(response));
    setThemeTitle("");
  }

  async function closeTheme() {
    if (!view.activeTheme) return;
    const response = await fetch(`/api/groups/${groupId}/themes/${view.activeTheme.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    if (!response.ok) throw new Error(await readError(response));
  }

  async function addText() {
    if (!view.activeTheme || !textBody.trim()) return;
    const response = await fetch(`/api/groups/${groupId}/themes/${view.activeTheme.id}/contents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "text", body: textBody.trim(), displayOrder: 0 }),
    });
    if (!response.ok) throw new Error(await readError(response));
    setTextBody("");
  }

  async function uploadFile(file: File) {
    if (!view.activeTheme) return;
    const themeId = view.activeTheme.id;
    const fileType = file.type === "application/pdf" ? "pdf" : "image";
    const presign = await fetch(`/api/groups/${groupId}/themes/${themeId}/content-upload-url`, {
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
    const register = await fetch(`/api/groups/${groupId}/themes/${themeId}/contents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "file", contentId, fileType, displayOrder: 0 }),
    });
    if (!register.ok) throw new Error(await readError(register));
  }

  async function deleteContent(contentId: string) {
    if (!view.activeTheme) return;
    const response = await fetch(
      `/api/groups/${groupId}/themes/${view.activeTheme.id}/contents/${contentId}`,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error(await readError(response));
  }

  async function removeMember(userId: string) {
    const response = await fetch(`/api/groups/${groupId}/members/${userId}`, { method: "DELETE" });
    if (!response.ok) throw new Error(await readError(response));
  }

  async function regenerateInvite() {
    const response = await fetch(`/api/groups/${groupId}/invite`, { method: "POST" });
    if (!response.ok) throw new Error(await readError(response));
  }

  async function deleteGroup() {
    const response = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    if (!response.ok) throw new Error(await readError(response));
    router.push("/groups");
  }

  return (
    <>
      <h1>{view.group.name}</h1>
      {error && <p className="error">{error}</p>}

      <section className="banner">
        <h2>Convite</h2>
        <p className="muted">Compartilhe o link ou o código para novos membros entrarem.</p>
        <p>
          <code>{view.group.inviteCode}</code>
        </p>
        {inviteLink && (
          <p>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                void navigator.clipboard.writeText(inviteLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Link copiado!" : "Copiar link de convite"}
            </button>
          </p>
        )}
        {isLeader && (
          <p>
            <button
              type="button"
              className="button secondary"
              disabled={working}
              onClick={() => {
                if (window.confirm("Gerar um novo convite? O código atual deixará de funcionar.")) {
                  void run(regenerateInvite);
                }
              }}
            >
              Gerar novo convite
            </button>
          </p>
        )}
      </section>

      <section>
        <h2>Membros ({view.group.memberCount})</h2>
        <ul>
          {view.members.map((member) => (
            <li key={member.userId}>
              {member.name} {member.role === "leader" ? "— líder" : ""}
              {isLeader && member.userId !== currentUserId && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="button secondary"
                    disabled={working}
                    onClick={() => void run(() => removeMember(member.userId))}
                  >
                    Remover
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Tema do grupo</h2>
        {view.activeTheme ? (
          <>
            <p>
              <strong>{view.activeTheme.title}</strong>
            </p>

            {view.activeTheme.contents.length > 0 && (
              <div>
                <h3>Textos de apoio</h3>
                <ul>
                  {view.activeTheme.contents.map((content) => (
                    <li key={content.id}>
                      {content.kind === "text" ? (
                        <span style={{ whiteSpace: "pre-wrap" }}>{content.body}</span>
                      ) : content.fileType === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={content.fileUrl ?? ""}
                          alt="Texto de apoio"
                          style={{ maxWidth: "100%" }}
                        />
                      ) : (
                        <a href={content.fileUrl ?? "#"} target="_blank" rel="noreferrer">
                          Abrir documento de apoio (PDF)
                        </a>
                      )}
                      {isLeader && (
                        <>
                          {" "}
                          <button
                            type="button"
                            className="button secondary"
                            disabled={working}
                            onClick={() => void run(() => deleteContent(content.id))}
                          >
                            Remover
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isLeader && (
              <div className="banner">
                <label htmlFor="textBody">Adicionar texto de apoio</label>
                <textarea
                  id="textBody"
                  rows={4}
                  value={textBody}
                  onChange={(event) => setTextBody(event.target.value)}
                />
                <p>
                  <button
                    className="button"
                    disabled={working || !textBody.trim()}
                    onClick={() => void run(addText)}
                  >
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

                <p>
                  <button
                    className="button secondary"
                    disabled={working}
                    onClick={() => {
                      if (window.confirm("Encerrar o tema agora?")) {
                        void run(closeTheme);
                      }
                    }}
                  >
                    Encerrar tema
                  </button>
                </p>
              </div>
            )}

            {!isLeader &&
              (hasEntryForActiveTheme ? (
                <p className="muted">Você já enviou sua redação para este tema.</p>
              ) : (
                <p>
                  <Link
                    className="button"
                    href={`/submissions/new?groupThemeId=${view.activeTheme.id}`}
                  >
                    Enviar redação
                  </Link>
                </p>
              ))}
          </>
        ) : isLeader ? (
          <div className="banner">
            <label htmlFor="themeTitle">Enunciado do novo tema</label>
            <textarea
              id="themeTitle"
              rows={3}
              value={themeTitle}
              onChange={(event) => setThemeTitle(event.target.value)}
            />
            <p>
              <button
                className="button"
                disabled={working || !themeTitle.trim()}
                onClick={() => void run(proposeTheme)}
              >
                Propor tema
              </button>
            </p>
          </div>
        ) : (
          <p className="muted">Nenhum tema ativo no momento.</p>
        )}
      </section>

      <section>
        <h2>Ranking</h2>
        {view.ranking.length === 0 ? (
          <p className="muted">Ainda não há redações corrigidas neste grupo.</p>
        ) : (
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
        )}
      </section>

      {isLeader && (
        <section>
          <h2>Excluir grupo</h2>
          <p className="muted">
            Isso remove o grupo, seus temas e o ranking para todos os membros.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={working}
            onClick={() => {
              if (window.confirm("Excluir este grupo permanentemente?")) {
                void run(deleteGroup);
              }
            }}
          >
            Excluir grupo
          </button>
        </section>
      )}
    </>
  );
}
