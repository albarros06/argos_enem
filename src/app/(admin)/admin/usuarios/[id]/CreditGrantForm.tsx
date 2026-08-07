"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? "Ocorreu um erro. Tente novamente.";
}

export function CreditGrantForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function submit() {
    setError(null);
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedAmount) || parsedAmount === 0) {
      setError("Informe uma quantidade inteira diferente de zero.");
      return;
    }
    if (!reason.trim()) {
      setError("Informe o motivo.");
      return;
    }

    setWorking(true);
    try {
      const response = await fetch(`/api/admin/usuarios/${userId}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, reason: reason.trim() }),
      });
      if (!response.ok) throw new Error(await readError(response));
      setAmount("");
      setReason("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro inesperado.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="banner">
      <h3>Ajustar créditos</h3>
      {error && <p className="error">{error}</p>}
      <label htmlFor="creditAmount">Quantidade (negativo para deduzir)</label>
      <input
        id="creditAmount"
        type="number"
        step={1}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <label htmlFor="creditReason">Motivo</label>
      <input
        id="creditReason"
        type="text"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <p>
        <button className="button" disabled={working} onClick={() => void submit()}>
          Aplicar ajuste
        </button>
      </p>
    </div>
  );
}
