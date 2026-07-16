"use client";

import { useState } from "react";
import Link from "next/link";
import Input from "@/components/Input/Input";
import Button from "@/components/Button/Button";
import styles from "../auth.module.css";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    setSubmitting(false);
    setSent(true);
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Recuperar senha</h1>
      {sent ? (
        <p className={styles.message}>
          Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            id="email"
            name="email"
            type="email"
            label="E-mail"
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
            {submitting ? "Enviando..." : "Enviar link"}
          </Button>
        </form>
      )}
      <div className={styles.footer}>
        <Link href="/login">Voltar ao login</Link>
      </div>
    </div>
  );
}
