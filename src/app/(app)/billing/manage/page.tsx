"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface SubscriptionView {
  tier: "entry" | "premium";
  planName: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  monthlyQuota: number;
  quotaRemaining: number;
  pendingPixPayment: {
    amountCents: number;
    pixQrCode: string | null;
    pixQrImage: string | null;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada (acesso até o fim do período)",
  expired: "Encerrada",
};

function formatPrice(amountCents: number): string {
  return (amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ManageSubscriptionPage() {
  const [subscription, setSubscription] = useState<SubscriptionView | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [upgradePix, setUpgradePix] = useState<{
    code: string | null;
    image: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/billing/subscription");
    setSubscription(response.ok ? await response.json() : null);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function cancelSubscription() {
    if (
      !window.confirm(
        "Cancelar a renovação? Você mantém o acesso e a cota até o fim do período já pago.",
      )
    ) {
      return;
    }
    setWorking(true);
    setError(null);
    const response = await fetch("/api/billing/cancel", { method: "POST" });
    if (response.ok) {
      setMessage("Renovação cancelada. Seu acesso continua até o fim do período pago.");
      await load();
    } else {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Não foi possível cancelar.");
    }
    setWorking(false);
  }

  async function upgradeToPremium() {
    setWorking(true);
    setError(null);
    const response = await fetch("/api/billing/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "pix" }),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.status === "upgraded") {
        setMessage("Upgrade concluído! Sua cota premium já está disponível.");
        await load();
      } else {
        setUpgradePix({ code: result.pixQrCode, image: result.pixQrImage });
        setMessage(
          `Pague ${formatPrice(result.amountCents)} (valor proporcional ao restante do ciclo) para ativar o Premium.`,
        );
      }
    } else {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Não foi possível fazer o upgrade.");
    }
    setWorking(false);
  }

  if (subscription === undefined) {
    return <p className="muted">Carregando...</p>;
  }

  if (subscription === null) {
    return (
      <>
        <h1>Assinatura</h1>
        <p>Você ainda não tem uma assinatura ativa.</p>
        <p>
          <Link className="button" href="/billing">
            Conhecer os planos
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Minha assinatura</h1>
      {message && <div className="banner">{message}</div>}
      {error && <p className="error">{error}</p>}

      <div className="card">
        <p>
          <strong>{subscription.planName}</strong> ·{" "}
          <span className="badge">{STATUS_LABELS[subscription.status] ?? subscription.status}</span>
        </p>
        <p>
          Correções neste ciclo: <strong>{subscription.quotaRemaining}</strong> de{" "}
          {subscription.monthlyQuota} restantes
        </p>
        <p>
          {subscription.cancelAtPeriodEnd ? "Acesso até" : "Próxima renovação em"}{" "}
          <strong>{new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}</strong>
        </p>
      </div>

      {subscription.pendingPixPayment && (
        <div className="card">
          <h2>Cobrança Pix pendente — {formatPrice(subscription.pendingPixPayment.amountCents)}</h2>
          {subscription.pendingPixPayment.pixQrImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`data:image/png;base64,${subscription.pendingPixPayment.pixQrImage}`}
              alt="QR code Pix"
              style={{ maxWidth: 240 }}
            />
          )}
          {subscription.pendingPixPayment.pixQrCode && (
            <>
              <p>Ou copie o código Pix:</p>
              <textarea
                readOnly
                value={subscription.pendingPixPayment.pixQrCode}
                rows={3}
                onFocus={(event) => event.target.select()}
              />
            </>
          )}
        </div>
      )}

      {upgradePix && (
        <div className="card">
          <h2>Pix do upgrade</h2>
          {upgradePix.image && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`data:image/png;base64,${upgradePix.image}`}
              alt="QR code Pix do upgrade"
              style={{ maxWidth: 240 }}
            />
          )}
          {upgradePix.code && (
            <textarea
              readOnly
              value={upgradePix.code}
              rows={3}
              onFocus={(event) => event.target.select()}
            />
          )}
        </div>
      )}

      <p>
        {subscription.tier === "entry" && subscription.status === "active" && !upgradePix && (
          <button onClick={() => void upgradeToPremium()} disabled={working}>
            Fazer upgrade para o Premium
          </button>
        )}{" "}
        {["active", "past_due"].includes(subscription.status) && (
          <button
            className="secondary"
            onClick={() => void cancelSubscription()}
            disabled={working}
          >
            Cancelar renovação
          </button>
        )}
      </p>
    </>
  );
}
