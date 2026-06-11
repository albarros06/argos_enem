"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Plan {
  id: string;
  tier: string;
  name: string;
  priceCents: number;
  monthlyQuota: number;
}

function formatPrice(priceCents: number): string {
  return (priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CheckoutForm() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [method, setMethod] = useState<"card" | "pix">("pix");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pix, setPix] = useState<{ code: string | null; image: string | null } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    fetch("/api/billing/plans")
      .then((response) => response.json())
      .then((plans: Plan[]) => setPlan(plans.find((item) => item.id === planId) ?? null));
  }, [planId]);

  // Após o envio, aguarda o webhook confirmar o pagamento (FR-024).
  useEffect(() => {
    if (!pix && !confirmed) {
      return;
    }
    const timer = setInterval(async () => {
      const response = await fetch("/api/billing/subscription");
      if (response.ok) {
        const subscription = await response.json();
        if (subscription?.status === "active") {
          setConfirmed(true);
          clearInterval(timer);
        }
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [pix, confirmed]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan) {
      return;
    }
    setError(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const card =
      method === "card"
        ? {
            holderName: form.get("holderName"),
            number: String(form.get("number") ?? "").replace(/\s/g, ""),
            expiryMonth: form.get("expiryMonth"),
            expiryYear: form.get("expiryYear"),
            ccv: form.get("ccv"),
          }
        : undefined;
    const response = await fetch("/api/billing/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, method, card }),
    });
    setSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Não foi possível iniciar a assinatura.");
      return;
    }
    const result = await response.json();
    setPix({ code: result.pixQrCode, image: result.pixQrImage });
  }

  if (!plan) {
    return <p className="muted">Carregando plano...</p>;
  }

  if (confirmed) {
    return (
      <div className="card">
        <h2>Pagamento confirmado! 🎉</h2>
        <p>Sua cota de {plan.monthlyQuota} correções mensais já está disponível.</p>
        <Link className="button" href="/submissions/new">
          Enviar redação
        </Link>
      </div>
    );
  }

  if (pix) {
    return (
      <div className="card">
        <h2>Aguardando pagamento</h2>
        {method === "pix" && pix.image && (
          <>
            <p>Escaneie o QR code no app do seu banco:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${pix.image}`}
              alt="QR code Pix"
              style={{ maxWidth: 240 }}
            />
          </>
        )}
        {method === "pix" && pix.code && (
          <>
            <p>Ou copie o código Pix:</p>
            <textarea readOnly value={pix.code} rows={3} onFocus={(e) => e.target.select()} />
          </>
        )}
        {method === "card" && <p>Processando o pagamento no cartão...</p>}
        <p className="muted">
          Assim que o pagamento for confirmado, sua cota é liberada automaticamente — esta página
          atualiza sozinha.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <strong>{plan.name}</strong> — {formatPrice(plan.priceCents)}/mês · {plan.monthlyQuota}{" "}
        correções mensais
      </div>
      <form onSubmit={handleSubmit}>
        <label>Forma de pagamento</label>
        <p>
          <label style={{ display: "inline", fontWeight: 400 }}>
            <input
              type="radio"
              name="method"
              checked={method === "pix"}
              onChange={() => setMethod("pix")}
              style={{ width: "auto", marginRight: 6 }}
            />
            Pix
          </label>{" "}
          <label style={{ display: "inline", fontWeight: 400, marginLeft: "1rem" }}>
            <input
              type="radio"
              name="method"
              checked={method === "card"}
              onChange={() => setMethod("card")}
              style={{ width: "auto", marginRight: 6 }}
            />
            Cartão de crédito
          </label>
        </p>

        {method === "card" && (
          <>
            <label htmlFor="holderName">Nome no cartão</label>
            <input id="holderName" name="holderName" required />
            <label htmlFor="number">Número do cartão</label>
            <input id="number" name="number" inputMode="numeric" required />
            <label htmlFor="expiryMonth">Validade (mês / ano)</label>
            <p style={{ display: "flex", gap: 8 }}>
              <input id="expiryMonth" name="expiryMonth" placeholder="MM" maxLength={2} required />
              <input name="expiryYear" placeholder="AAAA" maxLength={4} required />
              <input name="ccv" placeholder="CVV" maxLength={4} required />
            </p>
          </>
        )}

        {error && <p className="error">{error}</p>}
        <p>
          <button type="submit" disabled={submitting}>
            {submitting ? "Processando..." : `Assinar por ${formatPrice(plan.priceCents)}/mês`}
          </button>
        </p>
      </form>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <>
      <h1>Assinatura</h1>
      <Suspense>
        <CheckoutForm />
      </Suspense>
    </>
  );
}
