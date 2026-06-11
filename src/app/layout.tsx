import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Argos — Correção de Redações ENEM",
  description:
    "Envie a foto da sua redação manuscrita e receba uma correção alinhada às 5 competências oficiais do ENEM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
