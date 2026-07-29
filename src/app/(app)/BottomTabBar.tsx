"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./app-layout.module.css";

const TABS = [
  { href: "/dashboard", label: "Painel", paid: false },
  { href: "/submissions", label: "Redações", paid: false },
  { href: "/redacoes-semana", label: "Semana", paid: true },
  { href: "/groups", label: "Grupos", paid: true },
];

export function BottomTabBar({ isPaid }: { isPaid: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={styles.bottomTabBar} aria-label="Navegação principal">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        const locked = tab.paid && !isPaid;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.bottomTabItem} ${active ? styles.bottomTabItemActive : ""}`}
          >
            <span className={styles.bottomTabDot} aria-hidden="true" />
            {tab.label}
            {locked && (
              <span className={styles.bottomTabLock} aria-label="Exclusivo para assinantes">
                🔒
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
