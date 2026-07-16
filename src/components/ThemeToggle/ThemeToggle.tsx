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
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className="theme-toggle"
      style={{
        backgroundColor: 'var(--color-surface-fg)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border-default)',
        padding: 'var(--space-sm)',
        borderRadius: 'var(--radius-button)',
        cursor: 'pointer',
        fontSize: '14px',
        fontFamily: 'var(--type-family-body)',
        transition: 'color 150ms ease, background-color 150ms ease',
      }}
    >
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
