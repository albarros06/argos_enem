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
    sm: {
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: '1.3',
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
