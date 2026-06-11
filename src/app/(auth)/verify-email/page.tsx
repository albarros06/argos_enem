"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmail() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"working" | "ok" | "error">(token ? "working" : "error");
  const [message, setMessage] = useState(
    token ? "Confirmando seu e-mail..." : "Link inválido. Solicite um novo e-mail de confirmação.",
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      if (response.ok) {
        setStatus("ok");
        setMessage("E-mail confirmado! Você já pode enviar redações.");
      } else {
        const body = await response.json().catch(() => null);
        setStatus("error");
        setMessage(body?.error?.message ?? "Não foi possível confirmar o e-mail.");
      }
    });
  }, [token]);

  return (
    <main>
      <h1>Confirmação de e-mail</h1>
      <p className={status === "error" ? "error" : undefined}>{message}</p>
      {status === "ok" && (
        <p>
          <Link className="button" href="/login">
            Entrar
          </Link>
        </p>
      )}
      {status === "error" && <ResendForm />}
    </main>
  );
}

function ResendForm() {
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    setSent(true);
  }

  if (sent) {
    return <p>Se o e-mail estiver cadastrado, enviamos um novo link de confirmação.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Reenviar confirmação para</label>
      <input id="email" name="email" type="email" required />
      <p>
        <button type="submit">Reenviar e-mail</button>
      </p>
    </form>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
