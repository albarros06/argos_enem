import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Argos — Correção de Redações ENEM</h1>
      <p>
        Fotografe sua redação manuscrita e receba em minutos uma correção alinhada às 5 competências
        oficiais do ENEM: nota total, nota por competência, anotações no texto e comentário geral.
      </p>
      <p>Suas 3 primeiras correções são gratuitas.</p>
      <p>
        <Link className="button" href="/register">
          Criar conta
        </Link>{" "}
        <Link className="button secondary" href="/login">
          Entrar
        </Link>
      </p>
    </main>
  );
}
