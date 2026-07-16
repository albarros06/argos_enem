/**
 * Design System: Checkbox Component
 * Uses design tokens exclusively (no hardcoded values)
 */

import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Checkbox({ label, id, ...props }: CheckboxProps) {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={styles.wrapper}>
      <input type="checkbox" id={checkboxId} className={styles.input} {...props} />
      <label htmlFor={checkboxId} className={styles.label}>
        <span className={styles.checkmark}></span>
        {label}
      </label>
    </div>
  );
}
