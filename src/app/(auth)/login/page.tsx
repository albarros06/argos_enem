"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Input from "@/components/Input/Input";
import Button from "@/components/Button/Button";
import styles from "./login.module.css";

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
    <main className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Entrar</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
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
            label="Senha"
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
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <div className={styles.footer}>
          <Link href="/forgot-password">Esqueci minha senha</Link>
          <span>·</span>
          <Link href="/register">Criar conta</Link>
        </div>
      </div>
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
