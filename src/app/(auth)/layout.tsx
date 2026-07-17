import Link from "next/link";
import { ThemeToggleClient } from "@/components/ThemeToggle/ThemeToggleClient";
import styles from "./auth.module.css";

// Shell comum das páginas de autenticação: o container centralizado e o toggle
// de tema. Cada página renderiza apenas o próprio card.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className={styles.themeToggleWrapper}>
        <ThemeToggleClient />
      </div>
      <main className={styles.container}>
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.stack}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true" />
            Argos
          </Link>
          {children}
        </div>
      </main>
    </>
  );
}
