# Contract: Design Tokens API

**Phase**: 1 (Design) | **Date**: 2026-07-15

## Overview

This contract defines how design tokens are organized, named, exported, and consumed within the Argos UI system. All components MUST adhere to this contract to ensure consistency and theme interoperability.

## Token Format

### CSS Custom Properties (Primary)

**Definition**: CSS variables defined in `src/styles/tokens.css` and theme overrides in `src/styles/theme.css`

**Naming Convention**: `--[category]-[property]-[variant]`

**Categories**:
- `color` — colors with dark/light theme variants
- `space` — spacing scale (margins, padding, gaps)
- `radius` — border radius values
- `shadow` — elevation and special shadows
- `type` — typography styles (font, size, weight, line-height, tracking)
- `gradient` — gradient definitions (currently only brand gradient)

**Usage in CSS**:
```css
.button-primary {
  background-color: var(--color-primary-brand);
  padding: var(--space-md);
  border-radius: var(--radius-button);
  box-shadow: var(--shadow-sm);
  font: var(--type-body);
}
```

**Usage in React/JSX**:
```jsx
<button
  style={{
    backgroundColor: 'var(--color-primary-brand)',
    padding: 'var(--space-md)',
    borderRadius: 'var(--radius-button)',
  }}
>
  Primary Action
</button>
```

### Optional: TypeScript Export

**File**: `src/tokens/index.ts` (optional, for type safety during development)

**Format**:
```typescript
// src/tokens/colors.ts
export const colors = {
  primary: {
    brand: { dark: '#2E5BFF', light: '#0052CC' },
  },
  secondary: {
    violet: { dark: '#8A3FFE', light: '#6B2FC3' },
  },
  // ... rest of palette
};

// src/tokens/spacing.ts
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '24px',
  xl: '32px',
};

// src/tokens/index.ts
export { colors, spacing, radii, shadows, typography, gradients };
```

**Usage** (optional):
```typescript
import { colors, spacing } from '@/tokens';

const buttonStyles = {
  backgroundColor: colors.primary.brand.dark,
  padding: spacing.md,
};
```

**Note**: TypeScript exports are optional; components should prefer CSS custom properties for flexibility and theme switching performance.

---

## Token Categories & Values

### Color Tokens

**Naming**: `--color-[semantic-name]-[variant]` or `--color-[hue]-[level]`

**Dark Theme** (default):
```css
/* Primary brand */
--color-primary-brand: #2E5BFF;

/* Secondary (violet) */
--color-secondary-violet: #8A3FFE;

/* Neutrals (5-step ink scale) */
--color-surface-bg: #0E0E13;      /* background */
--color-surface-fg: #1A1A23;      /* elevated surfaces */
--color-text-primary: #F5F5F5;    /* main text */
--color-text-secondary: #A0A0A0;  /* secondary text */
--color-text-tertiary: #606060;   /* tertiary text */

/* Borders */
--color-border-default: rgba(255, 255, 255, 0.08);  /* 8% white */

/* Semantic colors */
--color-error: #FF4C4C;
--color-warning: #FFB800;
--color-success: #4CAF50;
--color-info: #2E5BFF;

/* Gradients */
--gradient-brand: linear-gradient(90deg, #2E5BFF 0%, #8A3FFE 100%);
```

**Light Theme** (`[data-theme="light"]` or `prefers-color-scheme: light`):
```css
--color-primary-brand: #0052CC;
--color-surface-bg: #FFFFFF;
--color-text-primary: #1A1A1A;
/* ... light theme overrides */
```

### Spacing Tokens

**Naming**: `--space-[size]`

**Scale** (4px base unit):
```css
--space-xs: 4px;    /* 1 unit */
--space-sm: 8px;    /* 2 units */
--space-md: 12px;   /* 3 units */
--space-lg: 24px;   /* 6 units */
--space-xl: 32px;   /* 8 units */
--space-2xl: 48px;  /* 12 units */
```

### Typography Tokens

**Naming**: `--type-[role]-[variant]` (or use `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing` separately)

**Fonts**:
- Display & body: `Space Grotesk` (sans-serif)
- Labels & eyebrows: `IBM Plex Mono` (monospace)

**Styles**:
```css
/* Headings */
--type-heading-xl: 40px / 1.2 Space Grotesk 700;  /* -0.02em tracking */
--type-heading-lg: 32px / 1.2 Space Grotesk 600;
--type-heading-md: 24px / 1.2 Space Grotesk 600;
--type-heading-sm: 20px / 1.3 Space Grotesk 600;

/* Body text */
--type-body-lg: 16px / 1.5 Space Grotesk 400;
--type-body-md: 14px / 1.5 Space Grotesk 400;  /* default */
--type-body-sm: 12px / 1.5 Space Grotesk 400;

/* Labels (uppercase, wide tracking) */
--type-label-lg: 14px / 1 IBM Plex Mono 700 uppercase;  /* +0.16em tracking */
--type-label-sm: 12px / 1 IBM Plex Mono 600 uppercase;

/* Mono (code, meta) */
--type-mono: 12px / 1.5 IBM Plex Mono 400;
```

### Radius Tokens

**Naming**: `--radius-[component-or-size]`

**Scale** (soft geometric):
```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 18px;
--radius-xl: 22px;
--radius-2xl: 26px;
--radius-pill: 999px;  /* for buttons, badges, toggles */

/* Component-specific */
--radius-button: 8px;      /* or var(--radius-sm) */
--radius-input: 8px;
--radius-card: 18px;       /* or var(--radius-lg) */
--radius-modal: 22px;
```

### Shadow Tokens

**Naming**: `--shadow-[elevation-or-purpose]`

**Elevation**:
```css
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.15);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.20);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.25);

/* Special: glow for featured elements */
--shadow-glow: 0 0 24px rgba(142, 63, 254, 0.2);  /* violet halo */
```

### Gradient Tokens

**Naming**: `--gradient-[purpose]`

**Brand**:
```css
--gradient-brand: linear-gradient(90deg, #2E5BFF 0%, #8A3FFE 100%);
```

**Note**: Only the brand gradient is defined. No speculative gradients.

---

## Theme Switching Contract

### CSS Attribute

**Root element**: `<html>` or `<body>`

**Attribute**: `data-theme="dark" | "light"`

**Default**: dark (system preference or user preference via localStorage)

**CSS Implementation**:
```css
/* Default (dark theme) */
:root {
  --color-surface-bg: #0E0E13;
  --color-text-primary: #F5F5F5;
  /* ... all dark theme tokens */
}

/* Light theme override */
:root[data-theme="light"] {
  --color-surface-bg: #FFFFFF;
  --color-text-primary: #1A1A1A;
  /* ... all light theme tokens */
}
```

### Persistence

**localStorage key**: `"theme-preference"`

**Value**: `"dark" | "light"`

**Lifecycle**:
1. On page load: read localStorage
2. If set: apply via `document.documentElement.setAttribute('data-theme', theme)`
3. If unset: check system preference via `window.matchMedia('(prefers-color-scheme: dark)')`
4. On user toggle: update localStorage and attribute

---

## Component Usage Contract

### Requirement

**All components MUST use only design tokens for:**
- Colors (backgrounds, text, borders, shadows)
- Spacing (margins, padding, gaps)
- Typography (font-family, size, weight, line-height, tracking)
- Shape (border-radius)
- Elevation (box-shadow)

**Violation**: Hardcoded values (hex colors, px sizes, etc.) outside of token definitions.

**Exception**: Computed values (e.g., `width: calc(var(--space-lg) * 2)`) are acceptable if no token covers the use case; document the exception.

### Pattern: Token-Only Component

```tsx
// ✅ CORRECT: Using tokens
function Button({ children, variant = 'primary' }) {
  return (
    <button
      className={cn(
        'font-space-grotesk',  // from --type-body
        'px-space-md',         // from --space-md
        'py-space-sm',         // from --space-sm
        'rounded-radius-button',  // from --radius-button
        variant === 'primary' && 'bg-color-primary-brand text-white',
        variant === 'secondary' && 'bg-color-surface-fg text-color-text-primary',
      )}
    >
      {children}
    </button>
  );
}
```

```tsx
// ❌ INCORRECT: Hardcoded values
function Button({ children }) {
  return (
    <button
      style={{
        backgroundColor: '#2E5BFF',  // ❌ hardcoded; use --color-primary-brand
        padding: '12px 16px',        // ❌ hardcoded; use --space-sm/md
        borderRadius: '8px',         // ❌ hardcoded; use --radius-button
      }}
    >
      {children}
    </button>
  );
}
```

---

## Validation & Compliance

### Audit Criteria

1. **Token Coverage**: Every color, spacing, radius, or shadow value in the codebase MUST reference a token or computed token expression
2. **Theme Consistency**: Component renders identically in both dark and light themes (colors/contrasts adapt via token values)
3. **WCAG AA Contrast**: All foreground/background color combinations meet 4.5:1 (normal) or 3:1 (large) in both themes
4. **No Deprecation**: Hardcoded values from old design systems (if any) are completely removed

### Testing

1. **Visual Regression**: Screenshot tests verify components match DESIGN_SYSTEM.md across themes
2. **Contrast Verification**: Automated tools check WCAG AA compliance
3. **Token References**: Linting rule flags any hardcoded colors/sizes outside token definitions
4. **Theme Switching**: E2E test toggles theme; verifies all affected elements update instantly

---

## Versioning

- **Token additions**: non-breaking; existing tokens remain unchanged
- **Token value changes**: breaking; requires component audit and visual regression testing
- **Category additions**: non-breaking; follows same naming and structure conventions
- **Deprecation**: old tokens marked as deprecated in documentation; refactoring path provided; removal only in major version

---

## Example: Complete Button Implementation

```tsx
// src/components/Button/Button.tsx
import styles from './Button.module.css';

function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
}) {
  return (
    <button
      className={cn(
        styles.button,
        styles[`variant-${variant}`],
        styles[`size-${size}`],
        disabled && styles.disabled,
      )}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default Button;
```

```css
/* src/components/Button/Button.module.css */
.button {
  /* Layout */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);

  /* Typography */
  font-family: var(--type-body-md); /* or Space Grotesk explicitly */
  font-size: 14px;
  font-weight: 500;
  line-height: 1;

  /* Shape */
  border-radius: var(--radius-button);
  border: 1px solid transparent;

  /* Interaction */
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease;
}

.variant-primary {
  background-color: var(--color-primary-brand);
  color: white;
}

.variant-primary:hover:not(:disabled) {
  opacity: 0.9;  /* subtle brighten */
}

.variant-secondary {
  background-color: var(--color-surface-fg);
  color: var(--color-text-primary);
  border-color: var(--color-border-default);
}

.size-md {
  padding: var(--space-sm) var(--space-md);
}

.size-lg {
  padding: var(--space-md) var(--space-lg);
  font-size: 16px;
}

.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## References

- DESIGN_SYSTEM.md — Brand and visual guidelines
- data-model.md — Token entities and relationships
- quickstart.md — Developer setup and first component
