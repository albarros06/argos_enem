import Link from "next/link";
import { searchUsers } from "@/modules/admin";
import { UserSearch } from "./UserSearch";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await searchUsers(query) : [];

  return (
    <>
      <h1>Usuários</h1>
      <UserSearch initialQuery={query} />

      {!query ? (
        <p className="muted">Digite um e-mail (ou parte dele) para buscar uma conta.</p>
      ) : results.length === 0 ? (
        <p className="muted">Nenhum usuário encontrado para &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul>
          {results.map((user) => (
            <li key={user.id}>
              <Link href={`/admin/usuarios/${user.id}`}>{user.email}</Link> — {user.name}{" "}
              {!user.emailVerifiedAt && <span className="badge warning">Não verificado</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
