import { describe, expect, it } from "vitest";
import { computeTrend } from "@/modules/dashboard";

describe("dashboard trend computation", () => {
  it("is stable with fewer than two scores", () => {
    expect(computeTrend([])).toBe("stable");
    expect(computeTrend([160])).toBe("stable");
  });

  it("detects an upward trend", () => {
    expect(computeTrend([80, 80, 160, 200])).toBe("up");
  });

  it("detects a downward trend", () => {
    expect(computeTrend([200, 160, 80, 40])).toBe("down");
  });

  it("treats small variations (≤10 points) as stable", () => {
    expect(computeTrend([120, 120, 120, 120])).toBe("stable");
    expect(computeTrend([120, 130])).toBe("stable");
  });

  it("compares recent half against older half", () => {
    expect(computeTrend([40, 200, 200])).toBe("up");
  });
});
