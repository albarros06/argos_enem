/**
 * Design System: Logo Component
 * "Classic Almond" — the Argos eye mark (vesica eye + iris + pupil).
 * Uses design tokens exclusively (no hardcoded colors), so it repaints
 * correctly in light and dark themes.
 *
 * Ported 1:1 from the "Argos Logo Options" design (Option 1 / 1c).
 */

import styles from "./Logo.module.css";

interface LogoProps {
  /** Tile size in px. Default 32. */
  size?: number;
  /**
   * `solid` = brand-blue tile with a light eye (Option 1).
   * `soft`  = tinted tile with a brand-blue eye (Option 1c) — use where the
   *           surrounding surface is already light/tinted.
   */
  variant?: "solid" | "soft";
  /**
   * Accessible label. When provided, the mark is exposed as an image with
   * this label; otherwise it is treated as decorative (`aria-hidden`) — the
   * default, since the "Argos" wordmark usually sits right next to it.
   */
  title?: string;
  className?: string;
}

export function Logo({ size = 32, variant = "solid", title, className }: LogoProps) {
  // Dimensions are derived from the numeric `size` prop (layout, not theme),
  // so they stay inline; colors/shadow come from tokens via the CSS module.
  const radius = Math.round(size * 0.28); // matches the 112px tile → radius-2xl ratio
  const glyph = Math.round(size * 0.57); // matches the 64px glyph inside the 112px tile

  const a11y = title
    ? { role: "img" as const, "aria-label": title }
    : { "aria-hidden": true as const };

  return (
    <span
      className={[styles.tile, styles[`variant-${variant}`], className].filter(Boolean).join(" ")}
      style={{ width: size, height: size, borderRadius: radius }}
      {...a11y}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 64 64" fill="none">
        <path
          className={styles.eyeBody}
          d="M0 30C10 16 20 12 32 12C44 12 54 16 64 30C54 44 44 48 32 48C20 48 10 44 0 30Z"
        />
        <circle className={styles.iris} cx="32" cy="30" r="12" />
        <circle className={styles.pupil} cx="32" cy="30" r="5" />
      </svg>
    </span>
  );
}

export default Logo;
