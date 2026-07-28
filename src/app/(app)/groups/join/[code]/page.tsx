import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { joinGroup } from "@/modules/groups";
import { getActiveTier } from "@/modules/billing";
import { PremiumGate } from "@/components/PremiumGate/PremiumGate";

export const dynamic = "force-dynamic";

export default async function JoinGroupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();

  if ((await getActiveTier(user.id)) !== "premium") {
    return (
      <PremiumGate
        feature="Os Grupos"
        description="Entre em grupos de estudo, participe dos temas propostos pelo líder e dispute o ranking do grupo. Disponível no plano Premium."
      />
    );
  }

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
