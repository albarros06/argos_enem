import { expect, test } from "@playwright/test";

// Caminho feliz completo (US1): cadastro → verificação → upload → revisão →
// confirmação → avaliação com anotações. Vendors fake (FAKE_VENDORS=1).

// PNG 1×1 válido — o OCR fake ignora o conteúdo da imagem.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("register → verify → upload → review → confirm → evaluation", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@teste.com`;
  const password = "senha-segura-123";

  // Cadastro
  await page.goto("/register");
  await page.getByLabel("Nome").fill("Aluna E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/Senha/).fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Confira seu e-mail")).toBeVisible();

  // Verificação: pega o link da caixa de saída fake (em dev iria por e-mail/log)
  const outboxResponse = await request.get(`/api/fake-outbox?to=${encodeURIComponent(email)}`);
  const { messages } = await outboxResponse.json();
  expect(messages.length).toBeGreaterThan(0);
  await page.goto(messages[messages.length - 1].url);
  await expect(page.getByText("E-mail confirmado!")).toBeVisible();

  // Login
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Timeout maior: a navegação só completa após o dev server compilar /dashboard a frio.
  await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 });

  // Upload da foto com tema livre
  await page.goto("/submissions/new");
  await page.getByLabel(/Redação \(foto/).setInputFiles({
    name: "redacao.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await page.getByLabel("Tema livre").fill("Desigualdade educacional no Brasil");
  await page.getByRole("button", { name: "Enviar redação" }).click();

  // Revisão da transcrição (OCR fake retorna a redação de exemplo)
  await expect(page).toHaveURL(/\/review$/, { timeout: 30_000 });
  const textarea = page.getByLabel("Texto extraído da redação");
  await expect(textarea).toHaveValue(/desigualdade educacional/i);
  await page.getByRole("button", { name: /Confirmar e corrigir/ }).click();

  // Polling até a avaliação aparecer
  await expect(page.getByText("Nota total")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("720")).toBeVisible();
  await expect(page.getByText(/C1 — /)).toBeVisible();
  await expect(page.getByText(/C5 — /)).toBeVisible();
  await expect(page.locator("mark").first()).toBeVisible(); // anotação ancorada
  await expect(page.getByText("Comentário geral")).toBeVisible();

  // Painel reflete o resultado e o saldo caiu para 2
  await page.goto("/dashboard");
  await expect(page.getByText(/linha de base/)).toBeVisible();
  await expect(page.getByText("2 créditos")).toBeVisible();
});
