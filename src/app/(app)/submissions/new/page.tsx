import { prisma } from "@/lib/prisma";
import { business } from "@/lib/config";
import { getActiveTheme } from "@/modules/weekly";
import { NewSubmissionForm } from "./NewSubmissionForm";

export const dynamic = "force-dynamic";

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ weeklyThemeId?: string }>;
}) {
  const { weeklyThemeId } = await searchParams;

  // Submissão vinculada ao tema da semana: usa o tema ativo se o id conferir.
  let weeklyTheme: { id: string; title: string } | null = null;
  if (weeklyThemeId) {
    const active = await getActiveTheme();
    if (active && active.id === weeklyThemeId) {
      weeklyTheme = { id: active.id, title: active.title };
    }
  }

  const themes = weeklyTheme
    ? []
    : await prisma.essayTheme.findMany({
        where: { active: true },
        orderBy: { year: "desc" },
        select: { id: true, title: true, year: true },
      });

  return (
    <>
      <h1>{weeklyTheme ? "Redação da semana" : "Nova redação"}</h1>
      <p className="muted">
        Fotografe sua redação manuscrita com boa iluminação, sem cortes nem sombras.
      </p>
      <NewSubmissionForm
        themes={themes}
        maxUploadBytes={business.maxUploadBytes}
        weeklyTheme={weeklyTheme}
      />
    </>
  );
}
