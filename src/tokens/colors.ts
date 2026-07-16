/**
 * Design System: Color Tokens
 * Dark theme is default; light theme overrides via CSS [data-theme="light"]
 */

export const colors = {
  // Primary brand
  primary: {
    brand: '#2E5BFF', // Dark: #2E5BFF; Light: #0052CC
  },

  // Secondary
  secondary: {
    violet: '#8A3FFE', // Dark: #8A3FFE; Light: #6B2FC3
  },

  // Neutrals (5-step ink scale) — Dark theme
  surface: {
    bg: '#0E0E13', // Background (darkest)
    fg: '#1A1A23', // Elevated surfaces
  },

  text: {
    primary: '#F5F5F5', // Main text
    secondary: '#A0A0A0', // Secondary text
    tertiary: '#606060', // Tertiary text
  },

  // Borders
  border: {
    default: 'rgba(255, 255, 255, 0.08)', // 8% white
  },

  // Semantic colors
  semantic: {
    error: '#FF4C4C',
    warning: '#FFB800',
    success: '#4CAF50',
    info: '#2E5BFF',
  },
};
