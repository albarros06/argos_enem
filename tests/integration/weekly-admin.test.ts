import { beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, createAdmin, createUser, jsonRequest, resetDb, routeContext } from "../helpers";

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

import { GET as listRoute, POST as createRoute } from "@/app/api/admin/weekly-themes/route";
import { PATCH as patchRoute } from "@/app/api/admin/weekly-themes/[id]/route";

async function createTheme(title = "Tema da semana") {
  const response = await createRoute(
    jsonRequest("/api/admin/weekly-themes", "POST", { title }),
    routeContext({}),
  );
  return response;
}

describe("admin weekly themes API", () => {
  beforeEach(resetDb);

  it("forbids non-admin users", async () => {
    const user = await createUser();
    actAs(user.id);
    const response = await listRoute(jsonRequest("/api/admin/weekly-themes", "GET"), routeContext({}));
    expect(response.status).toBe(403);
  });

  it("creates a theme and rejects a second active one", async () => {
    const admin = await createAdmin();
    actAs(admin.id);

    const created = await createTheme();
    expect(created.status).toBe(201);

    const conflict = await createTheme("Outro tema");
    expect(conflict.status).toBe(409);
    const body = await conflict.json();
    expect(body.error.code).toBe("ACTIVE_THEME_EXISTS");
  });

  it("extends and then closes the active theme, blocking further changes", async () => {
    const admin = await createAdmin();
    actAs(admin.id);
    const created = await createTheme();
    const theme = await created.json();

    const newEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const extend = await patchRoute(
      jsonRequest(`/api/admin/weekly-themes/${theme.id}`, "PATCH", {
        action: "extend",
        endsAt: newEndsAt,
      }),
      routeContext({ id: theme.id }),
    );
    expect(extend.status).toBe(200);

    const close = await patchRoute(
      jsonRequest(`/api/admin/weekly-themes/${theme.id}`, "PATCH", { action: "close" }),
      routeContext({ id: theme.id }),
    );
    expect(close.status).toBe(200);

    const closeAgain = await patchRoute(
      jsonRequest(`/api/admin/weekly-themes/${theme.id}`, "PATCH", { action: "close" }),
      routeContext({ id: theme.id }),
    );
    expect(closeAgain.status).toBe(409);
  });
});
