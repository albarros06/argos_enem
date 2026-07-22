"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? "Ocorreu um erro. Tente novamente.";
}

export function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function createGroup() {
    setError(null);
    setWorking(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const group = await response.json();
      router.push(`/groups/${group.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Erro inesperado.");
      setWorking(false);
    }
  }

  async function joinGroup() {
    setError(null);
    setWorking(true);
    try {
      const response = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const group = await response.json();
      router.push(`/groups/${group.id}`);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Erro inesperado.");
      setWorking(false);
    }
  }

  return (
    <div className="banner">
      {error && <p className="error">{error}</p>}

      <h2>Criar grupo</h2>
      <label htmlFor="groupName">Nome do grupo</label>
      <input
        id="groupName"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={200}
      />
      <p>
        <button
          className="button"
          disabled={working || !name.trim()}
          onClick={() => void createGroup()}
        >
          Criar grupo
        </button>
      </p>

      <h2>Entrar com código de convite</h2>
      <label htmlFor="inviteCode">Código de convite</label>
      <input
        id="inviteCode"
        value={inviteCode}
        onChange={(event) => setInviteCode(event.target.value)}
      />
      <p>
        <button
          className="button secondary"
          disabled={working || !inviteCode.trim()}
          onClick={() => void joinGroup()}
        >
          Entrar no grupo
        </button>
      </p>
    </div>
  );
}
