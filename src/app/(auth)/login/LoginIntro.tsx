"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./LoginIntro.module.css";

const ANIMATED_DURATION_MS = 2000;
const REDUCED_MOTION_DURATION_MS = 200;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// No servidor não existe matchMedia; a preferência real substitui este valor
// no primeiro render do cliente, sem divergência (mesmo padrão de
// src/contexts/ThemeContext.tsx).
function getReducedMotionServerSnapshot(): boolean {
  return false;
}

function cx(...classes: (string | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Introdução de marca exclusiva da tela de login: sobreposição de tela cheia
// que pisca e abre o olho antes de se dissolver, revelando o formulário (já
// montado por trás). Auto-remove-se sozinha; nunca bloqueia o login.
export function LoginIntro() {
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(
      () => setVisible(false),
      reducedMotion ? REDUCED_MOTION_DURATION_MS : ANIMATED_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  if (!visible) {
    return null;
  }

  return (
    <div className={cx(styles.overlay, reducedMotion && styles.overlayStatic)} aria-hidden="true">
      <div className={styles.stack}>
        <div className={styles.face}>
          <div className={cx(styles.brow, reducedMotion && styles.browStatic)} />
          <div className={cx(styles.eye, reducedMotion && styles.eyeStatic)}>
            <div className={cx(styles.iris, reducedMotion && styles.irisStatic)}>
              <div className={styles.irisHighlight} />
            </div>
          </div>
        </div>
        <div className={styles.wordmark}>Argos</div>
      </div>
    </div>
  );
}
