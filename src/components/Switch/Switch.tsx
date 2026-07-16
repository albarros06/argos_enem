/**
 * Design System: Switch (Toggle) Component
 * Uses design tokens exclusively (no hardcoded values)
 */

import styles from './Switch.module.css';

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Switch({ label, id, ...props }: SwitchProps) {
  const switchId = id || `switch-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={styles.wrapper}>
      <input type="checkbox" id={switchId} className={styles.input} {...props} />
      <label htmlFor={switchId} className={styles.label}>
        <span className={styles.toggle}></span>
        {label}
      </label>
    </div>
  );
}
