/**
 * Design System: PremiumGate
 * Paywall exibido quando um recurso exclusivo do plano Premium (Redação da
 * semana, Grupos) é acessado por um usuário sem assinatura premium vigente.
 * Server component — sem hooks. Usa apenas tokens do design system.
 */

import Link from "next/link";
import Button from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import styles from "./PremiumGate.module.css";

interface PremiumGateProps {
  /** Nome do recurso bloqueado, ex.: "A Redação da semana". */
  feature: string;
  /** Descrição do valor por trás do recurso. */
  description: string;
}

export function PremiumGate({ feature, description }: PremiumGateProps) {
  return (
    <Card variant="elevated" className={styles.gate}>
      <span className={styles.lock} aria-hidden="true">
        🔒
      </span>
      <span className={styles.tag}>Exclusivo Premium</span>
      <h1 className={styles.title}>{feature} é um recurso Premium</h1>
      <p className={styles.description}>{description}</p>
      <div className={styles.actions}>
        <Link href="/billing">
          <Button variant="primary" size="lg">
            Assinar Premium
          </Button>
        </Link>
        <Link href="/dashboard" className={styles.back}>
          Voltar ao painel
        </Link>
      </div>
    </Card>
  );
}

export default PremiumGate;
