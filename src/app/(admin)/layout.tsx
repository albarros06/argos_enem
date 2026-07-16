import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/LogoutButton";

// Gate do painel administrativo: somente sessões com role de administrador
// (FR-001). Implementado como guarda de layout no runtime Node (Prisma).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") {
    redirect("/");
  }

  return (
    <>
      <nav className="appnav">
        <strong>Admin</strong>
        <Link href="/admin/redacoes-semana">Redações da semana</Link>
        <Link href="/admin/metricas">Métricas</Link>
        <span style={{ marginLeft: "auto" }}>
          <LogoutButton />
        </span>
      </nav>
      <main>{children}</main>
    </>
  );
}
