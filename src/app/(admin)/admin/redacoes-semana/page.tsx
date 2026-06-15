import { getActiveTheme, getThemeContents, listThemes } from "@/modules/weekly";
import { AdminThemes } from "./AdminThemes";

export const dynamic = "force-dynamic";

export default async function AdminWeeklyThemesPage() {
  const { items } = await listThemes(1);
  const active = await getActiveTheme();
  const contents = active ? await getThemeContents(active.id) : [];

  return (
    <AdminThemes
      themes={items.map((theme) => ({
        id: theme.id,
        title: theme.title,
        status: theme.status,
        endsAt: theme.endsAt.toISOString(),
        participantCount: theme.participantCount,
      }))}
      active={
        active
          ? {
              id: active.id,
              title: active.title,
              endsAt: active.endsAt.toISOString(),
              contents: contents.map((content) => ({
                id: content.id,
                kind: content.kind,
                body: content.body,
                fileType: content.fileType,
                fileUrl: content.fileUrl,
              })),
            }
          : null
      }
    />
  );
}
