# Argos — Correção de Redações ENEM

Plataforma web onde estudantes fotografam a redação manuscrita, revisam a
transcrição (OCR) e recebem uma avaliação alinhada às 5 competências oficiais
do ENEM: nota total (0–1000), notas por competência em passos de 40 pontos,
anotações ancoradas no texto e comentário geral. Um painel acompanha a
evolução histórica. Monetização freemium: 3 correções gratuitas e, depois,
assinatura em dois planos (entry/premium) cobrada via Asaas (cartão + Pix).

Especificação completa em `specs/001-enem-essay-grading/` (spec, plano,
modelo de dados, contratos de API).

## Stack

- **App**: Next.js 15 (App Router) + TypeScript, um único projeto full-stack
- **Banco**: PostgreSQL 16 via Prisma (imagens transitórias em Cloudflare R2)
- **OCR**: Google Cloud Vision (`DOCUMENT_TEXT_DETECTION`)
- **Correção**: Claude Sonnet 4.6 com rubrica em cache de prompt e saída JSON estruturada
- **Auth**: Auth.js v5 (credentials + JWT) · **E-mail**: Resend · **Pagamentos**: Asaas REST v3
- **Testes**: Vitest (unit + integração com Postgres de teste) e Playwright (E2E)

## Setup

Pré-requisitos: Node.js 22 LTS, pnpm, Docker.

```bash
pnpm install
cp .env.example .env      # preencha as chaves (veja quickstart.md)
docker compose up -d      # Postgres dev (5434) e de teste (5433)
pnpm prisma migrate dev   # aplica o schema
pnpm db:seed              # planos de assinatura + catálogo de temas
pnpm dev                  # http://localhost:3000
```

Em desenvolvimento sem chaves de vendors, use `FAKE_VENDORS=1`: OCR, LLM,
e-mail (caixa de saída em `/api/fake-outbox`), storage (upload local) e Asaas
passam a usar adaptadores fake em memória — nenhuma chamada externa.

## Comandos

```bash
pnpm lint && pnpm format:check   # gates de qualidade
pnpm test                        # Vitest (unit + integração; usa o Postgres 5433)
pnpm test:e2e                    # Playwright: caminho feliz completo (US1)
pnpm test:load                   # carga: USERS=1000 CONCURRENCY=50 contra um servidor FAKE_VENDORS=1
pnpm build && pnpm start         # build e servidor de produção
```

## Arquitetura

Camadas com dependência em sentido único — `app/` → `modules/` → `lib/`:

```text
src/
├── app/              # App Router: páginas e route handlers FINOS (sem regra de negócio)
│   ├── (auth)/       # cadastro, login, verificação de e-mail, redefinição de senha
│   ├── (app)/        # área autenticada: painel, redações, assinatura
│   └── api/          # handlers que delegam aos módulos
├── modules/          # regra de negócio; interface pública no index.ts de cada módulo
│   ├── auth/         # cadastro, verificação de e-mail, reset de senha, exclusão LGPD
│   ├── submissions/  # ciclo de vida da submissão + máquina de estados (fonte única)
│   ├── transcription/# adaptador Google Vision + rejeição por confiança baixa
│   ├── grading/      # rubrica ENEM versionada, adaptador LLM, validação de schema,
│   │                 #   ancoragem de anotações, regras de nota zero
│   ├── credits/      # ledger append-only: créditos grátis + cota mensal (consume/refund)
│   ├── billing/      # planos, adaptador Asaas, webhooks idempotentes, ciclos de cota
│   └── dashboard/    # agregações de evolução de nota e por competência
├── lib/              # transversal: prisma, config (Zod), storage R2, e-mail, logger, api
├── components/       # UI compartilhada (texto anotado, saldo de créditos…)
└── instrumentation.ts# inicia varreduras periódicas (submissões abandonadas, ciclos)
```

Pontos de projeto relevantes:

- **Máquina de estados da submissão**: `pending → awaiting_review → grading →
completed | failed | expired`. O crédito é consumido atomicamente na
  confirmação da transcrição e reembolsado se a correção falhar; a imagem é
  apagada ao sair de `awaiting_review` (LGPD/minimização).
- **Ledger de créditos**: `CreditTransaction` append-only; saldo = `SUM(amount)`.
  Cota mensal expira no fim do ciclo (sem rollover); créditos de cadastro não expiram.
- **Vendors atrás de adaptadores**: OCR/LLM/pagamentos podem ser trocados sem
  tocar na regra de negócio; cada adaptador tem um fake para testes/CI.
- **Webhooks Asaas idempotentes** via `WebhookEvent.id`; direitos só são
  concedidos na confirmação de pagamento.
- **Números de negócio** (preço, cota, créditos grátis) são seed/config, não código.
