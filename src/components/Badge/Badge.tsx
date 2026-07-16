/**
 * Design System: Badge Component
 * Uses design tokens exclusively (no hardcoded values)
 */

import styles from './Badge.module.css';

interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'error' | 'warning' | 'success';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'primary', children, className }: BadgeProps) {
  return (
    <span className={[styles.badge, styles[`variant-${variant}`], className].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}
