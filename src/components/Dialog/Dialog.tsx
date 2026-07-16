/**
 * Design System: Dialog Component (extends Modal)
 * Uses design tokens exclusively (no hardcoded values)
 */

import styles from './Dialog.module.css';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  children?: React.ReactNode;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
}: DialogProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
        {children && <div className={styles.content}>{children}</div>}
        <div className={styles.actions}>
          {secondaryAction && (
            <button className={styles.secondaryButton} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button className={styles.primaryButton} onClick={primaryAction.onClick}>
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
