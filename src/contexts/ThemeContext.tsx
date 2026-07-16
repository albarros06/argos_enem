/**
 * Design System: Theme Context
 * Optional: Provides theme state for components that need it
 */

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { type Theme, getThemePreference, setTheme, onThemeChange } from '@/lib/theme';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Get initial theme preference
    const initialTheme = getThemePreference();
    setThemeState(initialTheme);
    setMounted(true);

    // Listen for theme changes
    const unsubscribe = onThemeChange((newTheme) => {
      setThemeState(newTheme);
    });

    return unsubscribe;
  }, []);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    setThemeState(newTheme);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
