"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setSubmitting(false);
    if (result?.error) {
      setError("E-mail ou senha incorretos.");
    } else {
      router.push(searchParams.get("callbackUrl") ?? "/dashboard");
      router.refresh();
    }
  }

  return (
    <main>
      <h1>Entrar</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required />
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" required />
        {error && <p className="error">{error}</p>}
        <p>
          <button type="submit" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </p>
      </form>
      <p className="muted">
        <Link href="/forgot-password">Esqueci minha senha</Link> ·{" "}
        <Link href="/register">Criar conta</Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
