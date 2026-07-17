import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listSubmissions } from "@/modules/submissions";

const STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  pending: { label: "Processando redação", badge: "" },
  awaiting_review: { label: "Aguardando sua revisão", badge: "warning" },
  grading: { label: "Em correção", badge: "" },
  completed: { label: "Corrigida", badge: "success" },
  failed: { label: "Falhou", badge: "danger" },
  expired: { label: "Expirada", badge: "" },
};

export const dynamic = "force-dynamic";

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const { items, total, pageSize } = await listSubmissions(user.id, page);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <h1>Minhas redações</h1>
      {items.length === 0 ? (
        <div className="card">
          <p>Você ainda não enviou nenhuma redação.</p>
          <p>
            <Link className="button" href="/submissions/new">
              Enviar redação
            </Link>
          </p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tema</th>
              <th>Status</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {items.map((submission) => {
              const status = STATUS_LABELS[submission.status];
              return (
                <tr key={submission.id}>
                  <td>{new Date(submission.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <Link href={`/submissions/${submission.id}`}>{submission.themeText}</Link>
                  </td>
                  <td>
                    <span className={`badge ${status.badge}`}>{status.label}</span>{" "}
                    {submission.resultReady && (
                      <span className="badge success">Resultado novo</span>
                    )}
                  </td>
                  <td>{submission.totalScore ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {totalPages > 1 && (
        <p>
          {page > 1 && <Link href={`/submissions?page=${page - 1}`}>← Anteriores</Link>}{" "}
          <span className="muted">
            Página {page} de {totalPages}
          </span>{" "}
          {page < totalPages && <Link href={`/submissions?page=${page + 1}`}>Próximas →</Link>}
        </p>
      )}
    </>
  );
}
