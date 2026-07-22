import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { joinGroup } from "@/modules/groups";

export const dynamic = "force-dynamic";

export default async function JoinGroupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();

  const result = await joinGroup(user.id, code)
    .then((group) => ({ ok: true as const, group }))
    .catch((error) => {
      if (error instanceof ApiError) {
        return { ok: false as const, message: error.message };
      }
      throw error;
    });

  if (!result.ok) {
    return (
      <>
        <h1>Não foi possível entrar no grupo</h1>
        <p className="error">{result.message}</p>
        <p>
          <Link href="/groups">Voltar para meus grupos</Link>
        </p>
      </>
    );
  }

  redirect(`/groups/${result.group.id}`);
}
