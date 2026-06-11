import { describe, expect, it } from "vitest";
import type { SubmissionStatus } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { assertTransition, canTransition } from "@/modules/submissions/stateMachine";

const allowed: [SubmissionStatus, SubmissionStatus][] = [
  ["pending", "awaiting_review"],
  ["pending", "failed"],
  ["pending", "expired"],
  ["awaiting_review", "grading"],
  ["awaiting_review", "expired"],
  ["grading", "completed"],
  ["grading", "failed"],
];

const statuses: SubmissionStatus[] = [
  "pending",
  "awaiting_review",
  "grading",
  "completed",
  "failed",
  "expired",
];

describe("submission state machine", () => {
  it("allows exactly the legal transitions", () => {
    for (const from of statuses) {
      for (const to of statuses) {
        const expected = allowed.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to), `${from} → ${to}`).toBe(expected);
      }
    }
  });

  it("terminal states have no outgoing transitions", () => {
    for (const terminal of ["completed", "failed", "expired"] as SubmissionStatus[]) {
      for (const to of statuses) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });

  it("assertTransition throws 409 INVALID_STATE on illegal moves", () => {
    expect(() => assertTransition("completed", "grading")).toThrowError(ApiError);
    try {
      assertTransition("grading", "expired");
    } catch (error) {
      expect((error as ApiError).code).toBe("INVALID_STATE");
      expect((error as ApiError).status).toBe(409);
    }
  });

  it("assertTransition passes silently on legal moves", () => {
    expect(() => assertTransition("awaiting_review", "grading")).not.toThrow();
  });
});
