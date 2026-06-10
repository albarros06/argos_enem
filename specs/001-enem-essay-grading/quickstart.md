# Quickstart: Argos — ENEM Essay Grading Platform

**Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/api.md](./contracts/api.md)

## Prerequisites

- Node.js 22 LTS + pnpm
- Docker (local PostgreSQL)
- Accounts/keys: Anthropic API key, Google Cloud service account (Vision API enabled),
  Cloudflare R2 bucket + access key, Asaas **sandbox** API key, Resend API key

## Setup

```bash
pnpm install
cp .env.example .env          # fill the keys below
docker compose up -d postgres # local PostgreSQL 16
pnpm prisma migrate dev       # apply schema
pnpm prisma db seed           # subscription plans + essay theme catalog + config
pnpm dev                      # http://localhost:3000
```

### .env keys

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/argos
AUTH_SECRET=                  # npx auth secret
ANTHROPIC_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS_JSON=   # service-account JSON (single line)
R2_ENDPOINT= / R2_ACCESS_KEY_ID= / R2_SECRET_ACCESS_KEY= / R2_BUCKET=
ASAAS_API_KEY=                # sandbox key for dev
ASAAS_WEBHOOK_TOKEN=          # shared secret validated on /api/webhooks/asaas
RESEND_API_KEY=
APP_URL=http://localhost:3000
```

## Verify the core loop (US1)

1. Register at `/register`, confirm via the verification email (in dev, the link is
   also printed to the server log).
2. Upload a photo of a handwritten essay (PT-BR) and type a theme.
3. Review the transcription, fix OCR errors, confirm → credit consumed, grading starts.
4. Poll completes (~30–60s): total score, 5 competency scores, highlighted annotations,
   general feedback.
5. `/dashboard` shows the result; `/api/credits` shows 2 remaining free credits.

## Verify the paywall + billing (US3/US4, Asaas sandbox)

1. Exhaust the 3 free credits (or set the signup grant to 1 via seed config).
2. Next submission attempt → paywall with the two seeded plans.
3. Subscribe with an Asaas sandbox test card; expose your local webhook with
   `cloudflared tunnel` (or similar) and register the URL in the Asaas sandbox panel.
4. On the payment-confirmed webhook, quota is granted and submission unblocks.

## Tests

```bash
pnpm test            # Vitest unit + integration (spins test DB via docker compose)
pnpm test:e2e        # Playwright happy path (requires dev server + seeded DB)
pnpm lint && pnpm format:check
```

## Notes

- Grading runs in-process: keep a single `pnpm dev`/server instance in dev.
- Essay images are deleted at confirmation — re-upload to re-test OCR.
- Vendor adapters (`modules/transcription`, `modules/grading`, `modules/billing`)
  each ship a fake in-memory implementation for tests — no external calls in CI.
