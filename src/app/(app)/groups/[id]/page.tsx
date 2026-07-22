import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { getEntryByUserAndTheme, getGroupDetailView, requireGroupMember } from "@/modules/groups";
import { GroupDetail } from "./GroupDetail";

export const dynamic = "force-dynamic";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  try {
    await requireGroupMember(id, user.id);
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <h1>Grupo</h1>
          <p className="error">{error.message}</p>
          <p>
            <Link href="/groups">Voltar para meus grupos</Link>
          </p>
        </>
      );
    }
    throw error;
  }

  const view = await getGroupDetailView(id, user.id);
  const isLeader = view.group.leaderId === user.id;
  const myEntry = view.activeTheme
    ? await getEntryByUserAndTheme(view.activeTheme.id, user.id)
    : null;

  return (
    <GroupDetail
      groupId={id}
      view={{
        group: view.group,
        members: view.members.map((member) => ({
          ...member,
          joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
        })),
        activeTheme: view.activeTheme
          ? {
              id: view.activeTheme.id,
              title: view.activeTheme.title,
              publishedAt: view.activeTheme.publishedAt.toISOString(),
              contents: view.activeTheme.contents,
            }
          : null,
        ranking: view.ranking.map((row) => ({
          ...row,
          submittedAt: row.submittedAt.toISOString(),
        })),
      }}
      isLeader={isLeader}
      currentUserId={user.id}
      hasEntryForActiveTheme={Boolean(myEntry)}
    />
  );
}
