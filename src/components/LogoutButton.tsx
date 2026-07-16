"use client";

import { signOut } from "next-auth/react";
import Button from "@/components/Button/Button";

export function LogoutButton() {
  return (
    <Button variant="secondary" size="md" onClick={() => signOut({ callbackUrl: "/" })}>
      Sair
    </Button>
  );
}
