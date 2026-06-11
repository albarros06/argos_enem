"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: form.get("newPassword") }),
    });
    if (response.ok) {
      setDone(true);
    } else {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Não foi possível redefinir a senha.");
    }
  }

  if (done) {
    return (
      <main>
        <h1>Senha redefinida</h1>
        <p>
          Sua senha foi alterada.{" "}
          <Link className="button" href="/login">
            Entrar
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Redefinir senha</h1>
      {!token && <p className="error">Link inválido. Solicite um novo link de recuperação.</p>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="newPassword">Nova senha (mínimo 8 caracteres)</label>
        <input id="newPassword" name="newPassword" type="password" minLength={8} required />
        {error && <p className="error">{error}</p>}
        <p>
          <button type="submit" disabled={!token}>
            Redefinir senha
          </button>
        </p>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
