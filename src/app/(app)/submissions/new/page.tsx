import { prisma } from "@/lib/prisma";
import { business } from "@/lib/config";
import { getActiveTheme } from "@/modules/weekly";
import { getThemeById as getGroupThemeById } from "@/modules/groups";
import { NewSubmissionForm } from "./NewSubmissionForm";

export const dynamic = "force-dynamic";

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ weeklyThemeId?: string; groupThemeId?: string }>;
}) {
  const { weeklyThemeId, groupThemeId } = await searchParams;

  // Submissão vinculada ao tema da semana: usa o tema ativo se o id conferir.
  let weeklyTheme: { id: string; title: string } | null = null;
  if (weeklyThemeId) {
    const active = await getActiveTheme();
    if (active && active.id === weeklyThemeId) {
      weeklyTheme = { id: active.id, title: active.title };
    }
  }

  // Submissão vinculada a um tema de grupo: o próprio createSubmission valida
  // a associação e o estado ativo — aqui só é preciso o título para exibição.
  let groupTheme: { id: string; title: string } | null = null;
  if (groupThemeId && !weeklyTheme) {
    const theme = await getGroupThemeById(groupThemeId);
    if (theme && theme.status === "active") {
      groupTheme = { id: theme.id, title: theme.title };
    }
  }

  const themes =
    weeklyTheme || groupTheme
      ? []
      : await prisma.essayTheme.findMany({
          where: { active: true },
          orderBy: { year: "desc" },
          select: { id: true, title: true, year: true },
        });

  return (
    <>
      <h1>{weeklyTheme ? "Redação da semana" : groupTheme ? "Redação do grupo" : "Nova redação"}</h1>
      <p className="muted">
        Fotografe sua redação manuscrita com boa iluminação, sem cortes nem sombras, ou envie um PDF
        legível de uma página.
      </p>
      <NewSubmissionForm
        themes={themes}
        maxUploadBytes={business.maxUploadBytes}
        weeklyTheme={weeklyTheme}
        groupTheme={groupTheme}
      />
    </>
  );
}
