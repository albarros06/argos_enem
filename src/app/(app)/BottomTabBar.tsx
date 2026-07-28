"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./app-layout.module.css";

const TABS = [
  { href: "/dashboard", label: "Painel", premium: false },
  { href: "/submissions", label: "Redações", premium: false },
  { href: "/redacoes-semana", label: "Semana", premium: true },
  { href: "/groups", label: "Grupos", premium: true },
];

export function BottomTabBar({ isPremium }: { isPremium: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={styles.bottomTabBar} aria-label="Navegação principal">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        const locked = tab.premium && !isPremium;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.bottomTabItem} ${active ? styles.bottomTabItemActive : ""}`}
          >
            <span className={styles.bottomTabDot} aria-hidden="true" />
            {tab.label}
            {locked && (
              <span className={styles.bottomTabLock} aria-label="Exclusivo Premium">
                🔒
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
