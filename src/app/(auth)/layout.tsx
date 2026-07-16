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
      <main className={styles.container}>{children}</main>
    </>
  );
}
