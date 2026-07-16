/**
 * Design System: Theme Switching Utilities
 */

export type Theme = 'dark' | 'light';

const THEME_KEY = 'theme-preference';

/**
 * Get user's theme preference from localStorage or system preference
 */
export function getThemePreference(): Theme {
  // Check localStorage first
  const stored = typeof window !== 'undefined' ? localStorage.getItem(THEME_KEY) : null;
  if (stored === 'dark' || stored === 'light') {
    return stored as Theme;
  }

  // Light is the default experience; users can opt into dark via the toggle.
  return 'light';
}

/**
 * Set theme preference and update DOM
 */
export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;

  // Update localStorage
  localStorage.setItem(THEME_KEY, theme);

  // Update DOM attribute
  document.documentElement.setAttribute('data-theme', theme);

  // Dispatch event for listeners
  window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme } }));
}

/**
 * Initialize theme on page load (call as early as possible to prevent flash)
 */
export function initTheme(): void {
  if (typeof window === 'undefined') return;

  const theme = getThemePreference();
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Listen for theme changes
 */
export function onThemeChange(callback: (theme: Theme) => void): () => void {
  const handler = (event: Event) => {
    if (event instanceof CustomEvent) {
      callback(event.detail.theme);
    }
  };

  window.addEventListener('theme-change', handler);

  return () => {
    window.removeEventListener('theme-change', handler);
  };
}
