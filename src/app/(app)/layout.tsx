import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreditBalance } from "@/components/CreditBalance";
import { RenewalBanner } from "@/components/RenewalBanner";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggleClient } from "@/components/ThemeToggle/ThemeToggleClient";
import Button from "@/components/Button/Button";
import styles from "./app-layout.module.css";

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
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.navLinks}>
            <Link href="/dashboard" className={styles.navLink}>
              Painel
            </Link>
            <Link href="/submissions" className={styles.navLink}>
              Redações
            </Link>
            <Link href="/redacoes-semana" className={styles.navLink}>
              Redação da semana
            </Link>
          </div>
          <Link href="/submissions/new">
            <Button variant="primary" size="md">
              Nova redação
            </Button>
          </Link>
        </div>
        <div className={styles.navActions}>
          <ThemeToggleClient />
          <CreditBalance />
          {user?.role === "admin" && (
            <Link href="/admin" className={styles.navLink}>
              Admin
            </Link>
          )}
          <Link href="/billing/manage" className={styles.navLink}>
            Assinatura
          </Link>
          <LogoutButton />
        </div>
      </nav>
      <main className={styles.main}>
        <RenewalBanner />
        {children}
      </main>
    </>
  );
}
