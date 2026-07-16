import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreditBalance } from "@/components/CreditBalance";
import { RenewalBanner } from "@/components/RenewalBanner";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // A sessão (JWT) não carrega o role, então consultamos para decidir se o
  // link do painel administrativo deve aparecer na navegação (FR-001).
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  return (
    <>
      <nav className="appnav">
        <Link href="/dashboard">Painel</Link>
        <Link href="/submissions">Redações</Link>
        <Link href="/redacoes-semana">Redação da semana</Link>
        <Link className="button" href="/submissions/new">
          Nova redação
        </Link>
        <span style={{ marginLeft: "auto", display: "flex", gap: "0.8rem", alignItems: "center" }}>
          <CreditBalance />
          {user?.role === "admin" && <Link href="/admin">Admin</Link>}
          <Link href="/billing/manage">Assinatura</Link>
          <LogoutButton />
        </span>
      </nav>
      <main>
        <RenewalBanner />
        {children}
      </main>
    </>
  );
}
