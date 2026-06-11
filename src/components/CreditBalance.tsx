"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface Balance {
  freeRemaining: number;
  quotaRemaining: number;
}

// Indicador persistente de créditos no topo do app (FR-020).
export function CreditBalance() {
  const pathname = usePathname();
  const [balance, setBalance] = useState<Balance | null>(null);

  useEffect(() => {
    fetch("/api/credits")
      .then((response) => (response.ok ? response.json() : null))
      .then(setBalance)
      .catch(() => setBalance(null));
  }, [pathname]);

  if (!balance) {
    return null;
  }
  const total = balance.freeRemaining + balance.quotaRemaining;
  return (
    <span className={`badge ${total === 0 ? "danger" : total === 1 ? "warning" : "success"}`}>
      {total === 0
        ? "Sem créditos"
        : total === 1
          ? "Último crédito"
          : `${total} crédito${total > 1 ? "s" : ""}`}
    </span>
  );
}
