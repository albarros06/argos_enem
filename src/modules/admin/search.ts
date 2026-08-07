import { prisma } from "@/lib/prisma";

export interface UserSearchResult {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

const RESULT_CAP = 20;

// Busca por e-mail (parcial, case-insensitive), capada em 20 resultados e
// sem listagem irrestrita para consulta vazia (edge case da spec).
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  return prisma.user.findMany({
    where: { email: { contains: trimmed, mode: "insensitive" }, deletedAt: null },
    select: { id: true, email: true, name: true, emailVerifiedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: RESULT_CAP,
  });
}
