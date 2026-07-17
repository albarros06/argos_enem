import { expect, test } from "@playwright/test";

// US1: um aluno envia a redação como PDF de uma página e chega à revisão da
// transcrição, igual ao fluxo de foto. Vendors fake (FAKE_VENDORS=1) — o OCR
// fake ignora o conteúdo do arquivo e devolve a redação de exemplo.

// PDF mínimo; com FAKE_VENDORS o conteúdo é ignorado (o tipo vem do mimeType).
const PDF_1PAGE = Buffer.from("%PDF-1.4\n% redacao de teste\n");

test("upload de PDF de uma página chega à revisão da transcrição", async ({ page, request }) => {
  const email = `e2e-pdf-${Date.now()}@teste.com`;
  const password = "senha-segura-123";

  // Cadastro
  await page.goto("/register");
  await page.getByLabel("Nome").fill("Aluna PDF");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/Senha/).fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Confira seu e-mail")).toBeVisible();

  // Verificação via caixa de saída fake
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
  await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 });

  // Upload do PDF com tema livre
  await page.goto("/submissions/new");
  await page.getByLabel(/Redação \(foto/).setInputFiles({
    name: "redacao.pdf",
    mimeType: "application/pdf",
    buffer: PDF_1PAGE,
  });
  await page.getByLabel("Tema livre").fill("Desigualdade educacional no Brasil");
  await page.getByRole("button", { name: "Enviar redação" }).click();

  // Revisão da transcrição (OCR fake retorna a redação de exemplo)
  await expect(page).toHaveURL(/\/review$/, { timeout: 30_000 });
  const textarea = page.getByLabel("Texto extraído da redação");
  await expect(textarea).toHaveValue(/desigualdade educacional/i);
});
