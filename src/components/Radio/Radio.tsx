/**
 * Design System: Radio Component
 * Uses design tokens exclusively (no hardcoded values)
 */

import { useId } from 'react';
import styles from './Radio.module.css';

interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Radio({ label, id, ...props }: RadioProps) {
  const generatedId = useId();
  const radioId = id || generatedId;

  return (
    <div className={styles.wrapper}>
      <input type="radio" id={radioId} className={styles.input} {...props} />
      <label htmlFor={radioId} className={styles.label}>
        <span className={styles.radio}></span>
        {label}
      </label>
    </div>
  );
}
