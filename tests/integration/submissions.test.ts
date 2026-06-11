import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { storage, fakeStorageHas } from "@/lib/storage";
import { getBalance } from "@/modules/credits";
import { enqueueFakeTranscriptionResult, FAKE_ESSAY_TEXT } from "@/modules/transcription";
import { defaultFakeEvaluation, enqueueFakeGradingResult } from "@/modules/grading";
import { actAs, createUser, jsonRequest, resetDb, routeContext } from "../helpers";

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

import { POST as createRoute, GET as listRoute } from "@/app/api/submissions/route";
import { GET as getRoute, DELETE as abandonRoute } from "@/app/api/submissions/[id]/route";
import { POST as uploadedRoute } from "@/app/api/submissions/[id]/uploaded/route";
import { POST as confirmRoute } from "@/app/api/submissions/[id]/confirm/route";

const VALID_SHA = "a".repeat(64);

function createBody(overrides?: Record<string, unknown>) {
  return {
    themeText: "Desigualdade educacional no Brasil",
    imageSha256: VALID_SHA,
    contentType: "image/jpeg",
    sizeBytes: 500_000,
    ...overrides,
  };
}

async function startSubmission(): Promise<string> {
  const response = await createRoute(
    jsonRequest("/api/submissions", "POST", createBody()),
    routeContext({}),
  );
  expect(response.status).toBe(201);
  const { submissionId, uploadUrl } = await response.json();
  expect(uploadUrl).toContain("/api/fake-upload/");

  const imageKey = decodeURIComponent(new URL(uploadUrl).pathname.replace("/api/fake-upload/", ""));
  await storage().putObject(imageKey, Buffer.from("foto-fake"), "image/jpeg");
  return submissionId;
}

async function uploadAndExtract(submissionId: string) {
  const response = await uploadedRoute(
    jsonRequest(`/api/submissions/${submissionId}/uploaded`, "POST"),
    routeContext({ id: submissionId }),
  );
  return response.json();
}

async function waitForStatus(submissionId: string, expected: string) {
  await vi.waitFor(
    async () => {
      const submission = await prisma.submission.findUniqueOrThrow({
        where: { id: submissionId },
      });
      expect(submission.status).toBe(expected);
    },
    { timeout: 10_000, interval: 100 },
  );
}

describe("submission lifecycle", () => {
  beforeEach(resetDb);

  it("create → uploaded → confirm → completed, consuming exactly one credit", async () => {
    const user = await createUser();
    actAs(user.id);

    const submissionId = await startSubmission();
    const uploaded = await uploadAndExtract(submissionId);
    expect(uploaded.status).toBe("awaiting_review");

    const detail = await (
      await getRoute(
        jsonRequest(`/api/submissions/${submissionId}`, "GET"),
        routeContext({ id: submissionId }),
      )
    ).json();
    expect(detail.transcription.rawText).toBe(FAKE_ESSAY_TEXT);
    expect(detail.transcription.meanConfidence).toBeGreaterThan(0.6);

    const confirm = await confirmRoute(
      jsonRequest(`/api/submissions/${submissionId}/confirm`, "POST", {
        confirmedText: FAKE_ESSAY_TEXT,
      }),
      routeContext({ id: submissionId }),
    );
    expect(confirm.status).toBe(200);

    // Crédito consumido na confirmação (clarificação 1) e imagem apagada (FR-027a).
    expect((await getBalance(user.id)).freeRemaining).toBe(2);
    const afterConfirm = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(afterConfirm.imageKey).toBeNull();

    await waitForStatus(submissionId, "completed");
    const completed = await (
      await getRoute(
        jsonRequest(`/api/submissions/${submissionId}`, "GET"),
        routeContext({ id: submissionId }),
      )
    ).json();
    expect(completed.evaluation.totalScore).toBe(720);
    expect(completed.evaluation.competencies).toHaveLength(5);
    expect(completed.evaluation.annotations.length).toBeGreaterThanOrEqual(3);
    expect(completed.evaluation.annotations.some((a: { anchored: boolean }) => a.anchored)).toBe(
      true,
    );
    expect(completed.evaluation.generalFeedback).toBeTruthy();
  });

  it("extraction failure marks failed, deletes the image, and consumes no credit (FR-007)", async () => {
    const user = await createUser();
    actAs(user.id);
    enqueueFakeTranscriptionResult(new Error("vision indisponível"));

    const submissionId = await startSubmission();
    const uploaded = await uploadAndExtract(submissionId);

    expect(uploaded.status).toBe("failed");
    expect(uploaded.failureReason).toBe("extraction_failed");
    expect((await getBalance(user.id)).freeRemaining).toBe(3);
    const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(submission.imageKey).toBeNull();
  });

  it("low-confidence OCR is rejected without consuming credit (FR-007)", async () => {
    const user = await createUser();
    actAs(user.id);
    enqueueFakeTranscriptionResult({ text: FAKE_ESSAY_TEXT, meanConfidence: 0.3 });

    const submissionId = await startSubmission();
    const uploaded = await uploadAndExtract(submissionId);

    expect(uploaded.status).toBe("failed");
    expect(uploaded.failureReason).toBe("extraction_failed");
    expect((await getBalance(user.id)).freeRemaining).toBe(3);
  });

  it("too-short extracted text fails as insufficient_text", async () => {
    const user = await createUser();
    actAs(user.id);
    enqueueFakeTranscriptionResult({ text: "Só uma linha de texto.", meanConfidence: 0.95 });

    const submissionId = await startSubmission();
    const uploaded = await uploadAndExtract(submissionId);

    expect(uploaded.status).toBe("failed");
    expect(uploaded.failureReason).toBe("insufficient_text");
  });

  it("grading failure refunds the credit automatically (FR-015)", async () => {
    const user = await createUser();
    actAs(user.id);
    enqueueFakeGradingResult(new Error("llm fora do ar"));

    const submissionId = await startSubmission();
    await uploadAndExtract(submissionId);
    await confirmRoute(
      jsonRequest(`/api/submissions/${submissionId}/confirm`, "POST", {
        confirmedText: FAKE_ESSAY_TEXT,
      }),
      routeContext({ id: submissionId }),
    );
    expect((await getBalance(user.id)).freeRemaining).toBe(2);

    await waitForStatus(submissionId, "failed");
    const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(submission.failureReason).toBe("grading_failed");
    // O reembolso é gravado logo após a troca de status — aguarda o ledger.
    await vi.waitFor(
      async () => {
        expect((await getBalance(user.id)).freeRemaining).toBe(3);
      },
      { timeout: 5_000, interval: 100 },
    );
  });

  it("warns when a non-zero evaluation has fewer than 3 annotations (SC-005)", async () => {
    const user = await createUser();
    actAs(user.id);
    const sparse = defaultFakeEvaluation(FAKE_ESSAY_TEXT);
    sparse.annotations = sparse.annotations.slice(0, 1);
    enqueueFakeGradingResult(sparse);
    const warnSpy = vi.spyOn(logger, "warn");

    const submissionId = await startSubmission();
    await uploadAndExtract(submissionId);
    await confirmRoute(
      jsonRequest(`/api/submissions/${submissionId}/confirm`, "POST", {
        confirmedText: FAKE_ESSAY_TEXT,
      }),
      routeContext({ id: submissionId }),
    );
    await waitForStatus(submissionId, "completed");

    expect(warnSpy).toHaveBeenCalledWith(
      "low_annotation_count",
      expect.objectContaining({ submissionId, count: 1 }),
    );
    warnSpy.mockRestore();
  });

  it("rejects a confirmed text that diverges too much from the OCR output", async () => {
    const user = await createUser();
    actAs(user.id);
    const submissionId = await startSubmission();
    await uploadAndExtract(submissionId);

    const tooShort = await confirmRoute(
      jsonRequest(`/api/submissions/${submissionId}/confirm`, "POST", {
        confirmedText: "linha 1\nlinha 2\nlinha 3\nlinha 4\nlinha 5\nlinha 6\nlinha 7",
      }),
      routeContext({ id: submissionId }),
    );
    expect(tooShort.status).toBe(400);
    expect((await tooShort.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("confirm outside awaiting_review returns 409 INVALID_STATE", async () => {
    const user = await createUser();
    actAs(user.id);
    const submissionId = await startSubmission(); // ainda pending

    const response = await confirmRoute(
      jsonRequest(`/api/submissions/${submissionId}/confirm`, "POST", {
        confirmedText: FAKE_ESSAY_TEXT,
      }),
      routeContext({ id: submissionId }),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("INVALID_STATE");
  });

  it("abandoning before confirmation deletes the image and consumes nothing", async () => {
    const user = await createUser();
    actAs(user.id);
    const submissionId = await startSubmission();
    await uploadAndExtract(submissionId);
    const { imageKey } = await prisma.submission.findUniqueOrThrow({
      where: { id: submissionId },
    });

    const response = await abandonRoute(
      jsonRequest(`/api/submissions/${submissionId}`, "DELETE"),
      routeContext({ id: submissionId }),
    );
    expect(response.status).toBe(200);

    const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(submission.status).toBe("expired");
    expect(submission.imageKey).toBeNull();
    expect(fakeStorageHas(imageKey!)).toBe(false);
    expect((await getBalance(user.id)).freeRemaining).toBe(3);
  });

  it("duplicate image upload returns 409 unless forced", async () => {
    const user = await createUser();
    actAs(user.id);
    await startSubmission();

    const duplicate = await createRoute(
      jsonRequest("/api/submissions", "POST", createBody()),
      routeContext({}),
    );
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error.code).toBe("DUPLICATE_IMAGE");

    const forced = await createRoute(
      jsonRequest("/api/submissions", "POST", createBody({ force: true })),
      routeContext({}),
    );
    expect(forced.status).toBe(201);
  });

  it("unverified users cannot create submissions (FR-001)", async () => {
    const user = await createUser({ verified: false });
    actAs(user.id);

    const response = await createRoute(
      jsonRequest("/api/submissions", "POST", createBody()),
      routeContext({}),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("cross-user access returns 404 (FR-003)", async () => {
    const owner = await createUser();
    actAs(owner.id);
    const submissionId = await startSubmission();

    const intruder = await createUser();
    actAs(intruder.id);
    const response = await getRoute(
      jsonRequest(`/api/submissions/${submissionId}`, "GET"),
      routeContext({ id: submissionId }),
    );
    expect(response.status).toBe(404);
  });

  it("lists only the owner's submissions, newest first", async () => {
    const user = await createUser();
    actAs(user.id);
    await startSubmission();

    const other = await createUser();
    actAs(other.id);
    const response = await listRoute(jsonRequest("/api/submissions", "GET"), routeContext({}));
    const { items, total } = await response.json();
    expect(total).toBe(0);
    expect(items).toHaveLength(0);
  });
});
