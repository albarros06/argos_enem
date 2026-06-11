import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBalance } from "@/modules/credits";
import { getSubscriptionView, listActivePlans } from "@/modules/billing";

export const dynamic = "force-dynamic";

function formatPrice(priceCents: number): string {
  return (priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Paywall (FR-021): aparece quando créditos e cota acabam; conteúdo antigo
// permanece acessível. Para assinante entry sem cota, vira o upsell (FR-026).
export default async function BillingPage() {
  const user = await requireUser();
  const [balance, subscription, plans] = await Promise.all([
    getBalance(user.id),
    getSubscriptionView(user.id),
    listActivePlans(),
  ]);
  const total = balance.freeRemaining + balance.quotaRemaining;
  const isEntrySubscriber = subscription?.tier === "entry" && subscription.status === "active";
  const premium = plans.find((plan) => plan.tier === "premium");

  return (
    <>
      <h1>Planos</h1>

      {total === 0 && isEntrySubscriber && premium ? (
        <div className="banner">
          <p>
            Você usou todas as {subscription.monthlyQuota} correções do seu ciclo. Sua cota renova
            em{" "}
            <strong>{new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}</strong> —
            ou faça upgrade para o Premium e continue agora com {premium.monthlyQuota} correções
            mensais.
          </p>
          <p>
            <Link className="button" href="/billing/manage">
              Fazer upgrade para o Premium
            </Link>
          </p>
        </div>
      ) : total === 0 ? (
        <div className="banner">
          Seus créditos acabaram. Assine um plano para continuar enviando redações — suas correções
          e seu painel de progresso continuam acessíveis.
        </div>
      ) : (
        <p className="muted">
          Você ainda tem {total} crédito{total > 1 ? "s" : ""} disponíve{total > 1 ? "is" : "l"}.
        </p>
      )}

      {!subscription &&
        plans.map((plan) => (
          <div className="card" key={plan.id}>
            <h2>{plan.name}</h2>
            <p style={{ fontSize: "1.6rem", fontWeight: 700, margin: "0.2rem 0" }}>
              {formatPrice(plan.priceCents)}
              <span className="muted" style={{ fontSize: "0.9rem", fontWeight: 400 }}>
                /mês
              </span>
            </p>
            <ul>
              <li>{plan.monthlyQuota} correções por mês</li>
              <li>Nota total e por competência, alinhadas à grade oficial do ENEM</li>
              <li>Anotações no texto e comentário geral</li>
              <li>Painel de evolução por competência</li>
              <li>Pagamento por cartão ou Pix · cancele quando quiser</li>
            </ul>
            <Link className="button" href={`/billing/checkout?plan=${plan.id}`}>
              Assinar {plan.name}
            </Link>
          </div>
        ))}

      {subscription && !isEntrySubscriber && (
        <p>
          <Link className="button secondary" href="/billing/manage">
            Gerenciar minha assinatura
          </Link>
        </p>
      )}
    </>
  );
}
