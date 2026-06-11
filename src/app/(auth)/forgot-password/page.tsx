"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    setSent(true);
  }

  return (
    <main>
      <h1>Recuperar senha</h1>
      {sent ? (
        <p>Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required />
          <p>
            <button type="submit">Enviar link</button>
          </p>
        </form>
      )}
      <p className="muted">
        <Link href="/login">Voltar ao login</Link>
      </p>
    </main>
  );
}
