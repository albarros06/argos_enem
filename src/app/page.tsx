import Link from "next/link";
import Button from "@/components/Button/Button";
import { ThemeToggleClient } from "@/components/ThemeToggle/ThemeToggleClient";
import styles from "./page.module.css";

const HIGHLIGHTS = [
  {
    title: "5 competências",
    text: "Nota por competência em passos de 40 pontos, do jeito da banca.",
  },
  {
    title: "Anotações no texto",
    text: "Comentários ancorados exatamente onde o corretor apontaria.",
  },
  {
    title: "Evolução",
    text: "Acompanhe seu progresso redação após redação no painel.",
  },
];

export default function HomePage() {
  return (
    <>
      <header className={styles.topBar}>
        <span className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          Argos
        </span>
        <ThemeToggleClient />
      </header>

      <main className={styles.container}>
        <div className={styles.glow} aria-hidden="true" />

        <section className={styles.hero}>
          <span className={styles.eyebrow}>Correção de redações ENEM</span>
          <h1 className={styles.title}>
            Sua redação corrigida como no ENEM, em minutos.
          </h1>
          <p className={styles.subtitle}>
            Fotografe sua redação manuscrita e receba uma avaliação alinhada às 5 competências
            oficiais: nota total, nota por competência, anotações no texto e comentário geral.
          </p>
          <span className={styles.freeBadge}>Suas 3 primeiras correções são gratuitas</span>
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
        </section>

        <section className={styles.highlights} aria-label="O que você recebe">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className={styles.highlightCard}>
              <h2 className={styles.highlightTitle}>{item.title}</h2>
              <p className={styles.highlightText}>{item.text}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
