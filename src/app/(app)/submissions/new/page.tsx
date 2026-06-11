import { prisma } from "@/lib/prisma";
import { business } from "@/lib/config";
import { NewSubmissionForm } from "./NewSubmissionForm";

export const dynamic = "force-dynamic";

export default async function NewSubmissionPage() {
  const themes = await prisma.essayTheme.findMany({
    where: { active: true },
    orderBy: { year: "desc" },
    select: { id: true, title: true, year: true },
  });

  return (
    <>
      <h1>Nova redação</h1>
      <p className="muted">
        Fotografe sua redação manuscrita com boa iluminação, sem cortes nem sombras.
      </p>
      <NewSubmissionForm themes={themes} maxUploadBytes={business.maxUploadBytes} />
    </>
  );
}
