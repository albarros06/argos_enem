-- Enable Row-Level Security on every public-schema table (deny-by-default,
-- no policies). This app connects via the `postgres` role, which carries
-- BYPASSRLS and is therefore unaffected by this migration. Its purpose is
-- to close off Supabase's Data API (PostgREST) — reachable with the `anon`/
-- `authenticated` keys, neither of which bypasses RLS — which this app does
-- not use for any table. See specs/017-rls-implementation/spec.md.

ALTER TABLE "Annotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EssayTheme" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Evaluation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupTheme" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupThemeContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupThemeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitHit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Submission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transcription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeeklyTheme" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeeklyThemeContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeeklyThemeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
