/**
 * Design System: Tooltip Component
 * Uses design tokens exclusively (no hardcoded values)
 */

import { useState } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={styles.wrapper} onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
      {children}
      {isVisible && (
        <div className={`${styles.tooltip} ${styles[`position-${position}`]}`}>
          {content}
        </div>
      )}
    </div>
  );
}
