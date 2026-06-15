"use client";

import { useEffect, useState } from "react";

function format(remainingMs: number): string {
  if (remainingMs <= 0) {
    return "Encerrado";
  }
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}min`;
  }
  return `${hours}h ${minutes}min ${seconds}s`;
}

// Contador de tempo restante até o encerramento do tema (FR-018).
export function Countdown({ endsAt }: { endsAt: string }) {
  const target = new Date(endsAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return <strong aria-live="polite">Tempo restante: {format(target - now)}</strong>;
}
