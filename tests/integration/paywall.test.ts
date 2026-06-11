import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeCredit } from "@/modules/credits";
import {
  actAs,
  createSubmissionRow,
  createUser,
  jsonRequest,
  resetDb,
  routeContext,
  seedPlans,
} from "../helpers";

vi.mock("next-auth", () => ({
  default: () => ({
    handlers: { GET: async () => new Response(null), POST: async () => new Response(null) },
    auth: async () => {
      const userId = (globalThis as { __testUserId?: string | null }).__testUserId;
      return userId ? { user: { id: userId } } : null;
    },
    signIn: async () => undefined,
    signOut: async () => undefined,
  }),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (config: unknown) => config }));

import { GET as creditsRoute } from "@/app/api/credits/route";
import { GET as plansRoute } from "@/app/api/billing/plans/route";
import { POST as createSubmissionRoute } from "@/app/api/submissions/route";
import { GET as dashboardRoute } from "@/app/api/dashboard/route";
import { GET as listSubmissionsRoute } from "@/app/api/submissions/route";

async function exhaustFreeCredits(userId: string) {
  for (let i = 0; i < 3; i++) {
    const submission = await createSubmissionRow(userId);
    await consumeCredit(userId, submission.id);
  }
}

describe("free allowance and paywall", () => {
  beforeEach(resetDb);

  it("a new account starts with 3 free credits visible in /api/credits", async () => {
    const user = await createUser();
    actAs(user.id);

    const response = await creditsRoute(jsonRequest("/api/credits", "GET"), routeContext({}));
    expect(await response.json()).toMatchObject({ freeRemaining: 3, quotaRemaining: 0 });
  });

  it("balance reaches zero after the third consumption", async () => {
    const user = await createUser();
    actAs(user.id);
    await exhaustFreeCredits(user.id);

    const response = await creditsRoute(jsonRequest("/api/credits", "GET"), routeContext({}));
    expect(await response.json()).toMatchObject({ freeRemaining: 0, quotaRemaining: 0 });
  });

  it("blocks submission with 402 PAYWALL including the plans, before any upload (FR-021)", async () => {
    await seedPlans();
    const user = await createUser();
    actAs(user.id);
    await exhaustFreeCredits(user.id);

    const response = await createSubmissionRoute(
      jsonRequest("/api/submissions", "POST", {
        themeText: "Tema",
        imageSha256: "b".repeat(64),
        contentType: "image/jpeg",
        sizeBytes: 1000,
      }),
      routeContext({}),
    );
    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.error.code).toBe("PAYWALL");
    expect(body.error.details.plans).toHaveLength(2);
    expect(body.error.details.plans[0]).toMatchObject({ tier: "entry" });
  });

  it("exposes active plans on /api/billing/plans", async () => {
    await seedPlans();
    const response = await plansRoute(jsonRequest("/api/billing/plans", "GET"), routeContext({}));
    const plans = await response.json();
    expect(plans.map((plan: { tier: string }) => plan.tier)).toEqual(["entry", "premium"]);
    expect(plans[0].priceCents).toBeGreaterThan(0);
  });

  it("past content stays accessible at zero credits", async () => {
    const user = await createUser();
    actAs(user.id);
    await exhaustFreeCredits(user.id);

    const dashboard = await dashboardRoute(jsonRequest("/api/dashboard", "GET"), routeContext({}));
    expect(dashboard.status).toBe(200);

    const list = await listSubmissionsRoute(
      jsonRequest("/api/submissions", "GET"),
      routeContext({}),
    );
    expect(list.status).toBe(200);
    expect((await list.json()).total).toBe(3);
  });
});
