// Teste de carga do ciclo de submissão (SC-002/SC-008): simula USERS alunos
// enviando redações contra um servidor com FAKE_VENDORS=1 e mede o p95 de
// confirmação → avaliação concluída (meta: < 3 min).
//
// Uso:
//   FAKE_VENDORS=1 pnpm dev          # em outro terminal, apontando para o DB de teste
//   USERS=1000 CONCURRENCY=50 pnpm test:load

import crypto from "node:crypto";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const USERS = parseInt(process.env.USERS ?? "100", 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? "25", 10);
const P95_LIMIT_MS = parseInt(process.env.P95_LIMIT_MS ?? "180000", 10);
const POLL_INTERVAL_MS = 1000;

class Client {
  constructor(forwardedFor) {
    this.cookies = new Map();
    this.forwardedFor = forwardedFor;
  }

  async fetch(path, options = {}) {
    const headers = {
      ...options.headers,
      "x-forwarded-for": this.forwardedFor,
      cookie: [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    };
    const response = await fetch(`${BASE_URL}${path}`, { ...options, headers, redirect: "manual" });
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(";");
      const eq = pair.indexOf("=");
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    return response;
  }

  async json(path, method, body) {
    const response = await this.fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok && response.status !== 302) {
      throw new Error(`${method} ${path} → ${response.status}: ${await response.text()}`);
    }
    return response.json().catch(() => ({}));
  }
}

async function login(client, email, password) {
  const { csrfToken } = await client.json("/api/auth/csrf", "GET");
  const response = await client.fetch("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email, password, redirect: "false" }).toString(),
  });
  if (response.status >= 400) {
    throw new Error(`login falhou: ${response.status}`);
  }
}

async function runStudent(index) {
  const client = new Client(`10.${(index >> 8) & 255}.${index & 255}.7`);
  const email = `load-${Date.now()}-${index}@teste.com`;
  const password = "senha-segura-123";

  await client.json("/api/auth/register", "POST", { name: `Aluno ${index}`, email, password });
  const { messages } = await client.json(`/api/fake-outbox?to=${encodeURIComponent(email)}`, "GET");
  const token = new URL(messages.at(-1).url).searchParams.get("token");
  await client.json("/api/auth/verify-email", "POST", { token });
  await login(client, email, password);

  const imageBytes = crypto.randomBytes(2048);
  const { submissionId, uploadUrl } = await client.json("/api/submissions", "POST", {
    themeText: "Carga: desigualdade educacional",
    imageSha256: crypto.createHash("sha256").update(imageBytes).digest("hex"),
    contentType: "image/jpeg",
    sizeBytes: imageBytes.length,
  });
  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: imageBytes,
  });
  if (!upload.ok) {
    throw new Error(`upload falhou: ${upload.status}`);
  }
  await client.json(`/api/submissions/${submissionId}/uploaded`, "POST");

  const detail = await client.json(`/api/submissions/${submissionId}`, "GET");
  if (detail.status !== "awaiting_review") {
    throw new Error(`extração falhou: ${detail.status}/${detail.failureReason}`);
  }

  const confirmStart = Date.now();
  await client.json(`/api/submissions/${submissionId}/confirm`, "POST", {
    confirmedText: detail.transcription.rawText,
  });
  for (;;) {
    const view = await client.json(`/api/submissions/${submissionId}`, "GET");
    if (view.status === "completed") {
      return Date.now() - confirmStart;
    }
    if (view.status === "failed") {
      throw new Error("correção falhou");
    }
    if (Date.now() - confirmStart > P95_LIMIT_MS * 2) {
      throw new Error("timeout aguardando a correção");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function main() {
  console.log(`Carga: ${USERS} alunos, concorrência ${CONCURRENCY}, alvo p95 < ${P95_LIMIT_MS} ms`);
  const durations = [];
  const failures = [];
  let next = 0;

  const startedAt = Date.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < USERS) {
        const index = next++;
        try {
          durations.push(await runStudent(index));
        } catch (error) {
          failures.push(`aluno ${index}: ${error.message}`);
        }
      }
    }),
  );

  durations.sort((a, b) => a - b);
  const p95 = durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)] ?? Infinity;
  const median = durations[Math.floor(durations.length / 2)] ?? Infinity;
  console.log(`Concluídos: ${durations.length}/${USERS} em ${(Date.now() - startedAt) / 1000}s`);
  console.log(`confirm → completed — mediana: ${median} ms · p95: ${p95} ms`);
  if (failures.length > 0) {
    console.error(`Falhas (${failures.length}):\n${failures.slice(0, 10).join("\n")}`);
  }

  const ok = failures.length === 0 && p95 < P95_LIMIT_MS;
  console.log(ok ? "✅ SC-002/SC-008 atendidos" : "❌ meta não atendida");
  process.exit(ok ? 0 : 1);
}

main();
