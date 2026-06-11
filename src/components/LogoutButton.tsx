"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button className="secondary" onClick={() => signOut({ callbackUrl: "/" })}>
      Sair
    </button>
  );
}
