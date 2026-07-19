"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import styles from "./app-layout.module.css";

export function NavOverflowMenu({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className={styles.overflowMenu} ref={ref}>
      <button
        type="button"
        className={styles.overflowTrigger}
        aria-label="Mais opções"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open && (
        <div className={styles.overflowPanel}>
          {isAdmin && (
            <Link href="/admin" className={styles.overflowLink} onClick={() => setOpen(false)}>
              Admin
            </Link>
          )}
          <Link
            href="/billing/manage"
            className={styles.overflowLink}
            onClick={() => setOpen(false)}
          >
            Assinatura
          </Link>
          <div className={styles.overflowLogout}>
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}
