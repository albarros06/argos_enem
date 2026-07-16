import Link from "next/link";
import Button from "@/components/Button/Button";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Argos — Correção de Redações ENEM</h1>
        <p className={styles.subtitle}>
          Fotografe sua redação manuscrita e receba em minutos uma correção alinhada às 5 competências
          oficiais do ENEM: nota total, nota por competência, anotações no texto e comentário geral.
        </p>
        <p className={styles.freeText}>Suas 3 primeiras correções são gratuitas.</p>
        <div className={styles.actions}>
          <Link href="/register">
            <Button variant="primary" size="lg">
              Criar conta
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg">
              Entrar
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
