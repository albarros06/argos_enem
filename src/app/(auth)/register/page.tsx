"use client";

import { useState } from "react";
import Link from "next/link";
import Input from "@/components/Input/Input";
import Button from "@/components/Button/Button";
import { ThemeToggleClient } from "@/components/ThemeToggle/ThemeToggleClient";
import styles from "../auth.module.css";

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
      <>
        <div className={styles.themeToggleWrapper}>
          <ThemeToggleClient />
        </div>
        <main className={styles.container}>
          <div className={styles.card}>
            <h1 className={styles.title}>Confira seu e-mail</h1>
            <p className={styles.message}>
              Enviamos um link de confirmação para o seu e-mail. Confirme para começar a
              enviar redações.
            </p>
            <div className={styles.footer}>
              <Link href="/login">Ir para o login</Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <div className={styles.themeToggleWrapper}>
        <ThemeToggleClient />
      </div>
      <main className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Criar conta</h1>
          <form onSubmit={handleSubmit} className={styles.form}>
            <Input id="name" name="name" label="Nome" required disabled={submitting} />
            <Input
              id="email"
              name="email"
              type="email"
              label="E-mail"
              required
              disabled={submitting}
            />
            <Input
              id="password"
              name="password"
              type="password"
              label="Senha (mínimo 8 caracteres)"
              minLength={8}
              required
              disabled={submitting}
            />
            {error && <p className={styles.error}>{error}</p>}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={submitting}
              className={styles.submitButton}
            >
              {submitting ? "Criando..." : "Criar conta"}
            </Button>
          </form>
          <div className={styles.footer}>
            <span>Já tem conta?</span>
            <Link href="/login">Entrar</Link>
          </div>
        </div>
      </main>
    </>
  );
}
