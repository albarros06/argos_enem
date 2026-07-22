import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listForUser } from "@/modules/groups";
import { CreateGroupForm } from "./CreateGroupForm";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const user = await requireUser();
  const groups = await listForUser(user.id);

  return (
    <>
      <h1>Grupos</h1>
      <CreateGroupForm />

      {groups.length === 0 ? (
        <p className="muted">Você ainda não participa de nenhum grupo.</p>
      ) : (
        <ul>
          {groups.map((group) => (
            <li key={group.id}>
              <Link href={`/groups/${group.id}`}>{group.name}</Link>{" "}
              <span className="muted">
                ({group.role === "leader" ? "líder" : "membro"} — {group.memberCount} participantes
                {group.hasActiveTheme ? " — tema ativo" : ""})
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
