"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Input from "@/components/Input/Input";
import Button from "@/components/Button/Button";
import styles from "../auth.module.css";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: form.get("newPassword") }),
    });
    setSubmitting(false);
    if (response.ok) {
      setDone(true);
    } else {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Não foi possível redefinir a senha.");
    }
  }

  if (done) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>Senha redefinida</h1>
        <p className={styles.message}>Sua senha foi alterada.</p>
        <div className={styles.footer}>
          <Link href="/login">Entrar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Redefinir senha</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        {!token && (
          <p className={styles.error}>Link inválido. Solicite um novo link de recuperação.</p>
        )}
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          label="Nova senha (mínimo 8 caracteres)"
          minLength={8}
          required
          disabled={!token || submitting}
        />
        {error && <p className={styles.error}>{error}</p>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!token || submitting}
          className={styles.submitButton}
        >
          {submitting ? "Redefinindo..." : "Redefinir senha"}
        </Button>
      </form>
      <div className={styles.footer}>
        <Link href="/login">Voltar ao login</Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
