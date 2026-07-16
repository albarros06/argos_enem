# Design System: Token Usage Guide

**Purpose**: Guide developers on how to use design tokens when building new components or refactoring existing ones.

## Quick Start

### Rule: Use Tokens, Never Hardcode Values

Every color, spacing, radius, shadow, or typography value in your component MUST come from the design token system.

✅ **DO THIS**:
```css
.button {
  background-color: var(--color-primary-brand);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-button);
  box-shadow: var(--shadow-sm);
  font-family: var(--type-family-body);
}
```

❌ **NEVER DO THIS**:
```css
.button {
  background-color: #2E5BFF;  /* ❌ hardcoded */
  padding: 8px 12px;          /* ❌ hardcoded */
  border-radius: 8px;         /* ❌ hardcoded */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);  /* ❌ hardcoded */
}
```

## Token Categories

### Colors
**Format**: `--color-[category]-[variant]`

- **Primary**: `--color-primary-brand` (blue, changes per theme)
- **Neutrals**: `--color-surface-bg`, `--color-surface-fg`, `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`
- **Borders**: `--color-border-default` (8% opacity)
- **Semantic**: `--color-error`, `--color-warning`, `--color-success`, `--color-info`

**Theme Switching**: Colors automatically adapt when `[data-theme="light"]` is applied to the HTML root. No code changes needed.

### Spacing
**Format**: `--space-[size]`

- `--space-xs` = 4px (1 unit)
- `--space-sm` = 8px (2 units)
- `--space-md` = 12px (3 units)
- `--space-lg` = 24px (6 units)
- `--space-xl` = 32px (8 units)
- `--space-2xl` = 48px (12 units)

**Use for**: margins, padding, gaps between elements

### Border Radii
**Format**: `--radius-[size-or-component]`

- **Generic**: `--radius-sm` (8px), `--radius-md` (12px), `--radius-lg` (18px), `--radius-xl` (22px), `--radius-2xl` (26px)
- **Component-specific**: `--radius-button`, `--radius-input`, `--radius-card`, `--radius-modal`
- **Special**: `--radius-pill` (999px, for toggles and badges)

### Shadows
**Format**: `--shadow-[level]`

- `--shadow-sm` = subtle (cards, small elements)
- `--shadow-md` = medium (dropdowns, floating panels)
- `--shadow-lg` = large (modals, dialogs)
- `--shadow-glow` = brand accent (featured elements only)

### Typography
**Format**: `--type-family-[role]`

- `--type-family-display` = Space Grotesk (headings, display text)
- `--type-family-body` = Space Grotesk (body text, buttons, inputs)
- `--type-family-mono` = IBM Plex Mono (labels, code, mono text)

**Note**: For now, use font families directly. Typography sizes/weights are documented separately.

### Gradients
**Format**: `--gradient-[purpose]`

- `--gradient-brand` = blue→violet (2E5BFF → 8A3FFE)

**Use for**: Primary action backgrounds, accent borders (sparingly)

## Component Patterns

### Pattern 1: Simple Button

```tsx
// Button.tsx
import styles from './Button.module.css';

export function Button({ variant = 'primary', children, ...props }) {
  return (
    <button className={`${styles.button} ${styles[variant]}`} {...props}>
      {children}
    </button>
  );
}
```

```css
/* Button.module.css */
.button {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-button);
  font-family: var(--type-family-body);
  font-weight: 500;
  transition: color 150ms ease, background-color 150ms ease;
}

.primary {
  background-color: var(--color-primary-brand);
  color: white;
}

.primary:hover:not(:disabled) {
  opacity: 0.9;
}
```

### Pattern 2: Input with Label

```tsx
export function Input({ label, error, ...props }) {
  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <input className={styles.input} {...props} />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
```

```css
.wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.input {
  background-color: var(--color-surface-fg);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-input);
  padding: var(--space-sm) var(--space-md);
  font-family: var(--type-family-body);
}

.input:focus {
  outline: none;
  border-color: var(--color-primary-brand);
}

.error {
  color: var(--color-error);
  font-size: 12px;
}
```

### Pattern 3: Card

```tsx
export function Card({ variant = 'default', children }) {
  return (
    <div className={`${styles.card} ${styles[variant]}`}>
      {children}
    </div>
  );
}
```

```css
.card {
  background-color: var(--color-surface-fg);
  border-radius: var(--radius-card);
  padding: var(--space-lg);
  border: 1px solid var(--color-border-default);
}

.elevated {
  box-shadow: var(--shadow-md);
  border: none;
}

.elevated:hover {
  box-shadow: var(--shadow-lg);
}
```

## Dos and Don'ts

✅ **DO**:
- Use `var(--token-name)` in CSS for all values
- Reference TypeScript exports for type safety during development
- Combine tokens: `var(--space-sm) var(--space-md)` for padding shortcuts
- Test components in both dark and light themes (set `[data-theme="light"]` on HTML)
- Ask in #design-system Slack if a token doesn't exist

❌ **DON'T**:
- Hardcode color values (hex, rgb, etc.)
- Hardcode spacing/size values (px numbers)
- Create new tokens without updating `src/tokens/` and `src/styles/`
- Use utility classes if design tokens are available
- Assume token names; check `contracts/design-tokens.md` first

## Testing Your Component

### Dark Theme (Default)
No extra setup needed — tokens render dark values automatically.

### Light Theme
Add `data-theme="light"` to your test HTML:
```html
<html data-theme="light">
  <body>
    <button>Click me</button>
  </body>
</html>
```

### Theme Switching
Tokens adapt instantly when the attribute changes — no component re-render needed.

```javascript
document.documentElement.setAttribute('data-theme', 'light');
// All components using var(--color-*) update immediately
```

## Checklist Before PR

- [ ] No hardcoded colors, spacing, or radius values in CSS
- [ ] All token references use `var(--token-name)` syntax
- [ ] Component tested in both dark and light themes
- [ ] Token names match those in `contracts/design-tokens.md`
- [ ] New component follows patterns from Button/Input/Card
- [ ] JSDoc comments include token usage (e.g., "Uses `--color-primary-brand` for background")

## Questions?

Refer to:
- `contracts/design-tokens.md` — Complete token API and definitions
- `DESIGN_SYSTEM.md` — Brand guidelines and visual principles
- `src/tokens/` — Source of truth for all token values
- `src/styles/tokens.css`, `theme.css` — CSS custom property definitions
