# Quickstart: Design System UI Development

**Phase**: 1 (Design) | **Date**: 2026-07-15

## Overview

This guide helps developers set up and use the Argos Design System tokens to build or refactor components. By the end, you'll have a working button component using tokens and understand how to apply tokens to other components.

## Prerequisites

- Node.js 22 LTS (same as project)
- Familiarity with React, TypeScript, and CSS
- Read `contracts/design-tokens.md` for token format and naming

## Setup (Phase 1 Task)

### 1. Create Token Files

**Directory structure**:
```
src/tokens/
├── colors.ts
├── typography.ts
├── spacing.ts
├── radii.ts
├── shadows.ts
├── gradients.ts
└── index.ts
```

### 2. Define Color Tokens (Dark Theme First)

Create `src/tokens/colors.ts`:

```typescript
/**
 * Design System: Color Tokens
 * Dark theme is default; light theme overrides via CSS
 */

export const colors = {
  // Primary brand
  primary: {
    brand: '#2E5BFF',  // Dark theme; light override: #0052CC
  },
  
  // Secondary
  secondary: {
    violet: '#8A3FFE',
  },
  
  // Neutrals (5-step ink scale)
  surface: {
    bg: '#0E0E13',      // Background (darkest)
    fg: '#1A1A23',      // Elevated surfaces
  },
  
  text: {
    primary: '#F5F5F5',    // Main text
    secondary: '#A0A0A0',  // Secondary text
    tertiary: '#606060',   // Tertiary text
  },
  
  // Borders
  border: {
    default: 'rgba(255, 255, 255, 0.08)',  // 8% white
  },
  
  // Semantic
  semantic: {
    error: '#FF4C4C',
    warning: '#FFB800',
    success: '#4CAF50',
    info: '#2E5BFF',
  },
};
```

### 3. Define Spacing Tokens

Create `src/tokens/spacing.ts`:

```typescript
/**
 * Design System: Spacing Tokens
 * 4px base unit scale
 */

export const spacing = {
  xs: '4px',    // 1 unit
  sm: '8px',    // 2 units
  md: '12px',   // 3 units
  lg: '24px',   // 6 units
  xl: '32px',   // 8 units
  '2xl': '48px', // 12 units
};
```

### 4. Define Radii Tokens

Create `src/tokens/radii.ts`:

```typescript
/**
 * Design System: Border Radius Tokens
 * Soft geometric scale (8–26px)
 */

export const radii = {
  sm: '8px',
  md: '12px',
  lg: '18px',
  xl: '22px',
  '2xl': '26px',
  pill: '999px',  // for buttons, badges
  
  // Component-specific (aliases)
  button: '8px',
  input: '8px',
  card: '18px',
  modal: '22px',
};
```

### 5. Define Shadow Tokens

Create `src/tokens/shadows.ts`:

```typescript
/**
 * Design System: Shadow Tokens
 * Elevation levels + special effects
 */

export const shadows = {
  sm: '0 2px 8px rgba(0, 0, 0, 0.15)',
  md: '0 4px 16px rgba(0, 0, 0, 0.20)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.25)',
  glow: '0 0 24px rgba(142, 63, 254, 0.2)',  // violet halo
};
```

### 6. Define Typography Tokens

Create `src/tokens/typography.ts`:

```typescript
/**
 * Design System: Typography Tokens
 * Space Grotesk (display + body), IBM Plex Mono (labels)
 */

export const typography = {
  // Font families
  families: {
    display: '"Space Grotesk", sans-serif',
    body: '"Space Grotesk", sans-serif',
    mono: '"IBM Plex Mono", monospace',
  },
  
  // Heading styles
  heading: {
    xl: {
      fontSize: '40px',
      fontWeight: 700,
      lineHeight: '1.2',
      letterSpacing: '-0.02em',
    },
    lg: {
      fontSize: '32px',
      fontWeight: 600,
      lineHeight: '1.2',
      letterSpacing: '-0.02em',
    },
    md: {
      fontSize: '24px',
      fontWeight: 600,
      lineHeight: '1.2',
      letterSpacing: '-0.02em',
    },
  },
  
  // Body text
  body: {
    lg: {
      fontSize: '16px',
      fontWeight: 400,
      lineHeight: '1.5',
    },
    md: {
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: '1.5',
    },
    sm: {
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: '1.5',
    },
  },
  
  // Labels (uppercase, wide tracking)
  label: {
    lg: {
      fontSize: '14px',
      fontWeight: 700,
      lineHeight: '1',
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
    },
    sm: {
      fontSize: '12px',
      fontWeight: 600,
      lineHeight: '1',
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
    },
  },
};
```

### 7. Define Gradient Tokens

Create `src/tokens/gradients.ts`:

```typescript
/**
 * Design System: Gradient Tokens
 * Only brand gradient defined (blue → violet)
 */

export const gradients = {
  brand: 'linear-gradient(90deg, #2E5BFF 0%, #8A3FFE 100%)',
};
```

### 8. Export All Tokens

Create `src/tokens/index.ts`:

```typescript
/**
 * Design System: Token Exports
 * Central point for accessing all design tokens
 */

export { colors } from './colors';
export { spacing } from './spacing';
export { radii } from './radii';
export { shadows } from './shadows';
export { typography } from './typography';
export { gradients } from './gradients';

// Optional: aggregate export for convenience
export const tokens = {
  colors: require('./colors').colors,
  spacing: require('./spacing').spacing,
  radii: require('./radii').radii,
  shadows: require('./shadows').shadows,
  typography: require('./typography').typography,
  gradients: require('./gradients').gradients,
};
```

### 9. Create CSS Custom Properties

Create `src/styles/tokens.css`:

```css
/**
 * Design System: CSS Custom Properties
 * Dark theme (default)
 */

:root {
  /* Colors */
  --color-primary-brand: #2E5BFF;
  --color-secondary-violet: #8A3FFE;
  
  --color-surface-bg: #0E0E13;
  --color-surface-fg: #1A1A23;
  
  --color-text-primary: #F5F5F5;
  --color-text-secondary: #A0A0A0;
  --color-text-tertiary: #606060;
  
  --color-border-default: rgba(255, 255, 255, 0.08);
  
  --color-error: #FF4C4C;
  --color-warning: #FFB800;
  --color-success: #4CAF50;
  --color-info: #2E5BFF;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  
  /* Radii */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 22px;
  --radius-2xl: 26px;
  --radius-pill: 999px;
  --radius-button: 8px;
  --radius-input: 8px;
  --radius-card: 18px;
  --radius-modal: 22px;
  
  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.15);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.20);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.25);
  --shadow-glow: 0 0 24px rgba(142, 63, 254, 0.2);
  
  /* Typography (fonts) */
  --type-family-display: "Space Grotesk", sans-serif;
  --type-family-body: "Space Grotesk", sans-serif;
  --type-family-mono: "IBM Plex Mono", monospace;
  
  /* Gradients */
  --gradient-brand: linear-gradient(90deg, #2E5BFF 0%, #8A3FFE 100%);
}
```

### 10. Create Theme Overrides

Create `src/styles/theme.css`:

```css
/**
 * Design System: Theme Overrides
 * Light theme applied via [data-theme="light"]
 */

:root[data-theme="light"] {
  /* Colors */
  --color-primary-brand: #0052CC;
  --color-secondary-violet: #6B2FC3;
  
  --color-surface-bg: #FFFFFF;
  --color-surface-fg: #F5F5F5;
  
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #606060;
  --color-text-tertiary: #A0A0A0;
  
  --color-border-default: rgba(0, 0, 0, 0.08);
  
  /* Semantic colors stay same, or adjust if needed */
  /* --color-error, --color-warning, --color-success remain unchanged */
}
```

### 11. Import Styles in Root Layout

Update `src/app/layout.tsx`:

```tsx
import '@/styles/tokens.css';
import '@/styles/theme.css';

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <script>{`
          // Initialize theme on page load (before render)
          const theme = localStorage.getItem('theme-preference') || 
                        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
          document.documentElement.setAttribute('data-theme', theme);
        `}</script>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
```

---

## Example: Refactoring a Component

### Before (Hardcoded)

```tsx
// ❌ OLD: Hardcoded values
function Button({ children, variant = 'primary' }) {
  const style =
    variant === 'primary'
      ? {
          backgroundColor: '#2E5BFF',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          border: 'none',
        }
      : {
          backgroundColor: '#1A1A23',
          color: '#F5F5F5',
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        };

  return <button style={style}>{children}</button>;
}
```

### After (Using Tokens)

```tsx
// ✅ NEW: Using design tokens
import styles from './Button.module.css';

function Button({ children, variant = 'primary' }) {
  return (
    <button className={`${styles.button} ${styles[variant]}`}>
      {children}
    </button>
  );
}

export default Button;
```

```css
/* Button.module.css */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  /* Typography (body) */
  font-family: var(--type-family-body);
  font-size: 14px;
  font-weight: 500;
  
  /* Shape */
  border-radius: var(--radius-button);
  border: none;
  
  /* Spacing */
  padding: var(--space-sm) var(--space-md);
  
  /* Interaction */
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease, opacity 150ms ease;
}

.primary {
  background-color: var(--color-primary-brand);
  color: white;
}

.primary:hover:not(:disabled) {
  opacity: 0.9;
}

.secondary {
  background-color: var(--color-surface-fg);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
}

.secondary:hover:not(:disabled) {
  background-color: var(--color-surface-bg);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## Testing

### Visual Regression

```bash
# Run Playwright visual tests
npm run test:visual

# Update baseline if changes are approved
npm run test:visual -- --update
```

### Contrast Verification

```bash
# Check WCAG AA compliance (example with axe-core)
npm run test:a11y
```

### Token Reference Linting

Add ESLint rule to flag hardcoded colors/sizes:

```json
{
  "rules": {
    "color-no-invalid-hex": "error",
    "no-hardcoded-values": "warn"  // custom rule
  }
}
```

---

## Common Patterns

### Responsive Spacing

```css
.card {
  padding: var(--space-md);
}

@media (min-width: 768px) {
  .card {
    padding: var(--space-lg);
  }
}
```

### Conditional Styling

```tsx
<button
  className={cn(
    'px-space-md',
    variant === 'primary' && 'bg-color-primary-brand',
    variant === 'secondary' && 'bg-color-surface-fg',
    disabled && 'opacity-50',
  )}
>
  {children}
</button>
```

### Theme-Aware Components

```tsx
import { useEffect, useState } from 'react';

function ThemedComponent() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(theme);

    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme'));
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return <div>Current theme: {theme}</div>;
}
```

---

## Next Steps

1. **Phase 1 Tasks**:
   - Define all token categories (above)
   - Create theme switching infrastructure
   - Refactor first batch of components (P1 story: buttons, inputs, cards)

2. **Phase 2 Tasks**:
   - Refactor remaining components (P2, P3 stories)
   - Write visual regression tests
   - Audit for hardcoded values

3. **Phase 3 Tasks**:
   - Verify WCAG AA compliance
   - Performance benchmarking
   - Final consistency audit

---

## References

- `DESIGN_SYSTEM.md` — Brand guidelines and design decisions
- `contracts/design-tokens.md` — Token naming, format, and usage contract
- `data-model.md` — Token entities and relationships
- `plan.md` — Full implementation plan
- `spec.md` — Feature specification
