import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveTier } from "@/modules/billing";
import { prisma } from "@/lib/prisma";
import { CreditBalance } from "@/components/CreditBalance";
import { RenewalBanner } from "@/components/RenewalBanner";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggleClient } from "@/components/ThemeToggle/ThemeToggleClient";
import Button from "@/components/Button/Button";
import Logo from "@/components/Logo/Logo";
import { BottomTabBar } from "./BottomTabBar";
import { NavOverflowMenu } from "./NavOverflowMenu";
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

  // Redação da semana e Grupos são exclusivos do plano Premium: quando o
  // usuário não é premium, os links ganham um cadeado indicando o bloqueio.
  const isPremium = (await getActiveTier(session.user.id)) === "premium";

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <Link href="/dashboard" className={styles.brand} aria-label="Argos — início">
            <Logo size={26} />
            Argos
          </Link>
          <div className={styles.navLinks}>
            <Link href="/dashboard" className={styles.navLink}>
              Painel
            </Link>
            <Link href="/submissions" className={styles.navLink}>
              Redações
            </Link>
            <Link href="/redacoes-semana" className={styles.navLink}>
              Redação da semana
              {!isPremium && (
                <span className={styles.navLock} aria-label="Exclusivo Premium" title="Exclusivo Premium">
                  🔒
                </span>
              )}
            </Link>
            <Link href="/groups" className={styles.navLink}>
              Grupos
              {!isPremium && (
                <span className={styles.navLock} aria-label="Exclusivo Premium" title="Exclusivo Premium">
                  🔒
                </span>
              )}
            </Link>
          </div>
          <div className={styles.desktopOnly}>
            <Link href="/submissions/new">
              <Button variant="primary" size="md">
                Nova redação
              </Button>
            </Link>
          </div>
        </div>
        <div className={styles.navActions}>
          {/* Sempre visível: indicador persistente de créditos (FR-020). */}
          <ThemeToggleClient />
          <CreditBalance />
          <div className={styles.desktopOnly}>
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
          <NavOverflowMenu isAdmin={user?.role === "admin"} />
        </div>
      </nav>
      <main className={styles.main}>
        <RenewalBanner />
        {children}
      </main>
      <Link href="/submissions/new" className={styles.fab} aria-label="Nova redação">
        +
      </Link>
      <BottomTabBar isPremium={isPremium} />
    </>
  );
}
