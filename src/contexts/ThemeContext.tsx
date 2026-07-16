/**
 * Design System: Theme Context
 * Optional: Provides theme state for components that need it
 */

'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';
import { type Theme, getThemePreference, setTheme, onThemeChange } from '@/lib/theme';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// No servidor não existe localStorage nem matchMedia. Este valor é o que o HTML
// enviado contém e o que a hidratação compara; a preferência real substitui-o no
// primeiro render seguinte, sem divergência.
const getServerTheme = (): Theme => 'dark';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // setTheme (lib/theme) grava no localStorage e dispara 'theme-change', que
  // onThemeChange escuta — a releitura do snapshot fecha o ciclo.
  const theme = useSyncExternalStore(onThemeChange, getThemePreference, getServerTheme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
