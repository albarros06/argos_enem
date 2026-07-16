# Data Model: Design System UI

**Phase**: 1 (Design) | **Date**: 2026-07-15

## Core Entities

### TokenSet
Represents a collection of design tokens organized by category.

**Properties**:
- `id: string` — unique identifier (e.g., "colors", "typography")
- `name: string` — human-readable name (e.g., "Color Palette", "Typography System")
- `category: "color" | "typography" | "spacing" | "radius" | "shadow" | "gradient"`
- `tokens: Record<string, Token>` — map of token name → Token definition
- `variants: "dark" | "light" | "both"` — which themes this TokenSet applies to

### Token
A single design value with semantic meaning.

**Properties**:
- `name: string` — token name (e.g., "primary-brand", "lg", "button")
- `value: string | Record<"dark" | "light", string>` — CSS value or theme-specific values
- `description?: string` — human-readable explanation of purpose
- `cssVar: string` — generated CSS custom property name (e.g., "--color-primary-brand")
- `scope?: string[]` — components or layers where this token is applicable (e.g., ["buttons", "links"])

**Examples**:

**Color Token** (theme-specific):
```
{
  name: "primary-brand",
  value: { dark: "#2E5BFF", light: "#0052CC" },
  description: "Primary brand blue for buttons and accents",
  cssVar: "--color-primary-brand",
  scope: ["buttons", "links", "focus-states"]
}
```

**Spacing Token** (universal):
```
{
  name: "lg",
  value: "24px",
  description: "Large spacing (6 × base unit)",
  cssVar: "--space-lg",
  scope: ["cards", "containers", "sections"]
}
```

**Typography Token** (with variants):
```
{
  name: "heading-lg",
  value: {
    fontFamily: "Space Grotesk",
    fontSize: "32px",
    fontWeight: "600",
    lineHeight: "1.2",
    letterSpacing: "-0.02em"
  },
  description: "Large heading style",
  cssVar: "--type-heading-lg",
  scope: ["page-titles", "section-headings"]
}
```

### Theme
Defines how tokens adapt across visual contexts.

**Properties**:
- `id: "dark" | "light"`
- `name: string` (e.g., "Dark Theme", "Light Theme")
- `colorOverrides: Record<string, string>` — token name → value for this theme
- `description: string` — when/why to use this theme

**Dark Theme** (default):
- Background: `#0E0E13`
- Text: `#F5F5F5` (or lighter)
- Borders: 8% white opacity
- Shadows: subtle, violet-hued

**Light Theme** (print/social):
- Background: `#FFFFFF`
- Text: `#1A1A1A` (or darker)
- Borders: 8% black opacity
- Shadows: subtle, gray-hued

### Component (not a token, but affected by tokens)
Represents a reusable UI element that uses tokens.

**Properties**:
- `name: string` — component name (e.g., "Button", "Input", "Card")
- `tokens: string[]` — list of token names this component uses (e.g., ["color-primary-brand", "space-sm", "radius-button"])
- `status: "implemented" | "refactored" | "planned"` — migration status
- `variants: string[]` — component variants (e.g., "primary", "secondary", "danger")

**Examples**:
```
Button:
  tokens: ["color-primary-brand", "space-md", "radius-button", "shadow-sm", "type-body"]
  variants: ["primary", "secondary", "danger", "ghost"]
  
Input:
  tokens: ["color-surface-bg", "color-text", "space-sm", "radius-input", "type-body"]
  variants: ["default", "disabled", "error", "success"]
  
Card:
  tokens: ["color-surface-bg", "space-lg", "radius-card", "shadow-md"]
  variants: ["default", "elevated", "outlined"]
```

---

## Relationships & Constraints

1. **TokenSet → Token**: One-to-many. A TokenSet contains multiple Tokens.
2. **Token → Theme**: Many-to-many (via colorOverrides). A Token may have different values per Theme.
3. **Component → Token**: Many-to-many. A Component uses multiple Tokens; a Token is used by multiple Components.

**Constraints**:
- Token names within a category must be unique (e.g., no two color tokens named "primary-brand")
- CSS variable names must be unique across all TokenSets
- Component token references must point to existing Tokens
- WCAG AA contrast requirements: color tokens paired (foreground/background) must meet 4.5:1 ratio minimum in normal text

---

## State & Lifecycle

**Token Creation**:
1. Designer/PM defines semantic purpose (e.g., "primary button color")
2. Designer/architect extracts value(s) from approved design (e.g., `#2E5BFF` dark, `#0052CC` light)
3. Engineer creates Token definition with name, value, cssVar, description
4. Verification: token is referenceable by at least one Component; contrast requirements met

**Component Refactoring**:
1. Component identified as not using tokens (audit)
2. Component's hardcoded values mapped to existing Tokens
3. Component refactored: hardcoded values → `var(--token-name)`
4. Status updated to "refactored"
5. Tests verify component renders correctly across themes

**Theme Switching**:
1. User toggles theme preference (UI button or system setting)
2. ThemeContext updates active Theme
3. CSS applies theme-specific colorOverrides (browser re-renders affected elements)
4. Components automatically reflect new theme (no JS rerender needed)

---

## Extensibility

**Adding a New Token Category**:
1. Define tokens in `src/tokens/[category].ts`
2. Export from `src/tokens/index.ts`
3. Add corresponding CSS custom properties to `src/styles/tokens.css`
4. Document in quickstart.md and DESIGN_SYSTEM.md

**Adding a New Component**:
1. Implement component using existing Tokens
2. Document which Tokens it uses
3. Map component to data model (name, tokens, variants)
4. Add to component inventory for audit purposes

---

## Validation Rules

- **All color Tokens must have both dark and light values** (theme variants)
- **All components must use at least one Token** (no pure hardcoded UI)
- **Token descriptions must explain purpose, not implementation** (e.g., "Primary button color" not "CSS var for blue")
- **Component token lists must be complete** (audit catches missing references)
- **Unused Tokens are acceptable** (spec doesn't require all tokens to be used initially; future-proofing allowed)

---

## Success Metrics

- **SC-001**: 100% of active Components reference only Tokens (zero hardcoded color/spacing/radius)
- **SC-002**: All Tokens have values for both dark and light Themes
- **SC-006**: All color Token pairs meet WCAG AA contrast (4.5:1 normal, 3:1 large)
- **100% Token coverage** achieved through Component refactoring pipeline
