/**
 * Design System: Theme Toggle Component
 * Allows users to switch between dark and light themes
 */

'use client';

import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={`Mudar para o tema ${isDark ? 'claro' : 'escuro'}`}
      className="theme-toggle"
      style={{
        backgroundColor: 'var(--color-surface-alt)',
        color: 'var(--color-text-secondary)',
        border: '2px solid var(--color-border-default)',
        padding: 'var(--space-sm) var(--space-md)',
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: 700,
        fontFamily: 'var(--type-family-body)',
        transition: 'color 150ms ease, background-color 150ms ease',
      }}
    >
      {isDark ? 'Tema claro' : 'Tema escuro'}
    </button>
  );
}
