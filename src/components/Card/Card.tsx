/**
 * Design System: Card Component
 * Uses design tokens exclusively (no hardcoded values)
 */

import styles from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  className?: string;
}

export function Card({ children, variant = 'default', className }: CardProps) {
  return (
    <div
      className={[styles.card, styles[`variant-${variant}`], className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
