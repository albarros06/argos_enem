"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Input from "@/components/Input/Input";
import Button from "@/components/Button/Button";
import styles from "../auth.module.css";

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
    <div className={styles.card}>
      <h1 className={styles.title}>Confirmação de e-mail</h1>
      <p className={status === "error" ? styles.error : styles.message}>{message}</p>
      {status === "ok" && (
        <div className={styles.footer}>
          <Link href="/login">Entrar</Link>
        </div>
      )}
      {status === "error" && <ResendForm />}
    </div>
  );
}

function ResendForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    setSubmitting(false);
    setSent(true);
  }

  if (sent) {
    return (
      <p className={styles.message}>
        Se o e-mail estiver cadastrado, enviamos um novo link de confirmação.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Input
        id="email"
        name="email"
        type="email"
        label="Reenviar confirmação para"
        required
        disabled={submitting}
      />
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={submitting}
        className={styles.submitButton}
      >
        {submitting ? "Enviando..." : "Reenviar e-mail"}
      </Button>
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
