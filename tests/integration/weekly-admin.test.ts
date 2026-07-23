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
import { POST as addContentRoute } from "@/app/api/admin/weekly-themes/[id]/contents/route";
import { getActiveThemeView } from "@/modules/weekly/views";

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

  it("exposes support text in full to the active-theme view, without truncation", async () => {
    const admin = await createAdmin();
    actAs(admin.id);
    const theme = await (await createTheme()).json();

    // Longer than the old 80-char preview and multi-line, so a re-introduced
    // slice(0, 80) or a stripped newline would fail this assertion.
    const longBody = [
      "Primeiro parágrafo do texto de apoio, com mais de oitenta caracteres para que a exibição não corte o conteúdo em uma prévia.",
      "Segundo parágrafo, em nova linha, cuja quebra deve ser preservada.",
    ].join("\n");

    const added = await addContentRoute(
      jsonRequest(`/api/admin/weekly-themes/${theme.id}/contents`, "POST", {
        kind: "text",
        body: longBody,
        displayOrder: 0,
      }),
      routeContext({ id: theme.id }),
    );
    expect(added.status).toBe(201);

    const view = await getActiveThemeView();
    const textContent = view!.theme.contents.find((c) => c.kind === "text");
    expect(textContent!.body).toBe(longBody);
    expect(textContent!.body!.length).toBeGreaterThan(80);
  });
});
