"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function search() {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    router.push(`/admin/usuarios?${params.toString()}`);
  }

  return (
    <p>
      <label htmlFor="userSearchQuery">Buscar por e-mail</label>
      <input
        id="userSearchQuery"
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") search();
        }}
        placeholder="usuario@email.com"
      />{" "}
      <button className="button" onClick={search}>
        Buscar
      </button>
    </p>
  );
}
