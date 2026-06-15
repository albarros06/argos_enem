# Dev Quickstart: Redações da Semana

**Date**: 2026-06-15 | **Plan**: [plan.md](./plan.md)

Extension to `specs/001-enem-essay-grading/quickstart.md`. All existing setup steps
remain valid. The additions below cover only what is new for this feature.

---

## Prerequisites

No new external services. This feature reuses PostgreSQL and Cloudflare R2 already
configured in the base setup.

---

## 1. Apply Prisma Migration

After pulling this branch, run:

```bash
npx prisma migrate dev --name add-weekly-themes
```

This creates the three new tables (`WeeklyTheme`, `WeeklyThemeContent`,
`WeeklyThemeEntry`) and adds the `role` column to `User`.

---

## 2. Promote a User to Admin

After registering a test account, promote it via Prisma Studio or a one-off script:

```bash
# Option A — Prisma Studio (visual)
npx prisma studio
# Open User table → find your account → set role = ADMIN → Save

# Option B — one-off script
npx tsx scripts/promote-admin.ts your@email.com
```

`scripts/promote-admin.ts` is a thin wrapper:
```ts
import { prisma } from '../src/lib/prisma'
const email = process.argv[2]
await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } })
console.log(`Promoted ${email} to ADMIN`)
await prisma.$disconnect()
```

---

## 3. Access the Admin Panel

With an admin account logged in, navigate to:

```
http://localhost:3000/admin
```

The middleware redirects non-admin sessions to `/` (homepage). The admin panel is
not linked from any public navigation; access it by typing the URL directly.

---

## 4. Create a Test Weekly Theme

1. Go to `/admin/redacoes-semana`
2. Click **Novo Tema**
3. Fill in the enunciado (required) and optionally add support texts (text or file)
4. Click **Publicar** — theme goes live immediately with a 7-day deadline

---

## 5. Submit as a Premium Student

To test the full student flow:

1. Register a second account and subscribe it to the premium plan (use a test Asaas
   environment or promote credits directly via `CreditTransaction` seed)
2. Log in as that account
3. Navigate to `/redacoes-semana`
4. Follow the upload flow — the submission is linked to the active theme
5. Choose anonymity preference at the confirm step
6. After grading completes, check `/redacoes-semana` for your position in the ranking

---

## 6. Test Auto-Close

To test automatic theme closure without waiting 7 days, update `endsAt` to a past
timestamp via Prisma Studio or a test helper:

```sql
UPDATE "WeeklyTheme" SET "endsAt" = NOW() - INTERVAL '1 minute' WHERE status = 'ACTIVE';
```

The instrumentation sweep runs every minute and will pick up the expired theme,
close it, and compute final ranks. Check the server logs for the sweep output.

---

## New env vars

None. This feature requires no additional environment variables.
