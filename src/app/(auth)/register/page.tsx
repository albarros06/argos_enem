"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    setSubmitting(false);
    if (response.ok) {
      setDone(true);
    } else {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Não foi possível criar a conta.");
    }
  }

  if (done) {
    return (
      <main>
        <h1>Confira seu e-mail</h1>
        <p>
          Enviamos um link de confirmação para o seu e-mail. Confirme para começar a enviar
          redações.
        </p>
        <p>
          <Link href="/login">Ir para o login</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Criar conta</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="name">Nome</label>
        <input id="name" name="name" required />
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required />
        <label htmlFor="password">Senha (mínimo 8 caracteres)</label>
        <input id="password" name="password" type="password" minLength={8} required />
        {error && <p className="error">{error}</p>}
        <p>
          <button type="submit" disabled={submitting}>
            {submitting ? "Criando..." : "Criar conta"}
          </button>
        </p>
      </form>
      <p className="muted">
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </main>
  );
}
