"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./app-layout.module.css";

const TABS = [
  { href: "/dashboard", label: "Painel" },
  { href: "/submissions", label: "Redações" },
  { href: "/redacoes-semana", label: "Semana" },
  // 4th slot reserved for the upcoming student-groups feature (specs/009-student-groups).
  // "Financeiro" was removed here because it duplicated "Assinatura" in NavOverflowMenu
  // (both pointed to /billing/manage) — billing stays reachable via the overflow menu.
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className={styles.bottomTabBar} aria-label="Navegação principal">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.bottomTabItem} ${active ? styles.bottomTabItemActive : ""}`}
          >
            <span className={styles.bottomTabDot} aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
