"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SubscriptionView {
  status: string;
  pendingPixPayment: { amountCents: number } | null;
}

// Banner de renovação pendente: Pix não tem débito automático, então cada ciclo
// gera uma nova cobrança com QR próprio, exibida no app (clarificação 5 / R4).
export function RenewalBanner() {
  const pathname = usePathname();
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);

  useEffect(() => {
    fetch("/api/billing/subscription")
      .then((response) => (response.ok ? response.json() : null))
      .then(setSubscription)
      .catch(() => setSubscription(null));
  }, [pathname]);

  if (!subscription) {
    return null;
  }
  if (subscription.status === "past_due") {
    return (
      <div className="banner">
        Sua renovação está pendente — pague para manter sua cota de correções.{" "}
        <Link href="/billing/manage">Pagar agora</Link>
      </div>
    );
  }
  if (subscription.pendingPixPayment) {
    return (
      <div className="banner">
        Há uma cobrança Pix aguardando pagamento. <Link href="/billing/manage">Ver QR code</Link>
      </div>
    );
  }
  return null;
}
