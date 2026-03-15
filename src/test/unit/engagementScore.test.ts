import { describe, it, expect } from "vitest";
import { computeEngagementScore, EngagementInput } from "@/lib/engagementScore";

// Helper to build a full input with defaults — avoids repeating all 5 fields in every test.
// Every field defaults to 0 (completely disengaged), callers override what they're testing.
function input(overrides: Partial<EngagementInput> = {}): EngagementInput {
  return {
    sessionsLast30d: 0,
    connectionsLast30d: 0,
    streakDays: 0,
    fcEarnedLast30d: 0,
    contributionsLast30d: 0,
    ...overrides,
  };
}

describe("computeEngagementScore", () => {
  it("scores 0 with no activity → high risk", () => {
    const result = computeEngagementScore(input());
    expect(result.score).toBe(0);
    expect(result.churnRisk).toBe("high");
  });

  it("formula: (sessions×15) + (connections×10) + (streak×5) + (fc×2) + (contributions×8)", () => {
    const result = computeEngagementScore(input({
      sessionsLast30d: 2,
      connectionsLast30d: 1,
      streakDays: 3,
      fcEarnedLast30d: 5,
      contributionsLast30d: 1,
    }));
    // 30 + 10 + 15 + 10 + 8 = 73
    expect(result.score).toBe(73);
  });

  it("1 session, nothing else → 15, high risk", () => {
    const result = computeEngagementScore(input({ sessionsLast30d: 1 }));
    expect(result.score).toBe(15);
    expect(result.churnRisk).toBe("high");
  });

  // ── Churn risk boundary tests ──
  // These verify the non-linear thresholds: <20 = high, 20-49 = medium, 50+ = low

  it("score < 20 → high risk (boundary)", () => {
    // 1 session(15) + 2 FC(4) = 19
    const result = computeEngagementScore(input({ sessionsLast30d: 1, fcEarnedLast30d: 2 }));
    expect(result.score).toBe(19);
    expect(result.churnRisk).toBe("high");
  });

  it("score exactly 20 → medium risk (boundary)", () => {
    // 1 session(15) + 1 streak(5) = 20
    const result = computeEngagementScore(input({ sessionsLast30d: 1, streakDays: 1 }));
    expect(result.score).toBe(20);
    expect(result.churnRisk).toBe("medium");
  });

  it("score 49 → medium risk (boundary)", () => {
    // 3 sessions(45) + 2 FC(4) = 49
    const result = computeEngagementScore(input({ sessionsLast30d: 3, fcEarnedLast30d: 2 }));
    expect(result.score).toBe(49);
    expect(result.churnRisk).toBe("medium");
  });

  it("score exactly 50 → low risk (boundary)", () => {
    // 2 sessions(30) + 2 connections(20) = 50
    const result = computeEngagementScore(input({ sessionsLast30d: 2, connectionsLast30d: 2 }));
    expect(result.score).toBe(50);
    expect(result.churnRisk).toBe("low");
  });

  // ── Cap tests ──

  it("score caps at 100", () => {
    // 7 sessions(105) → capped at 100
    const result = computeEngagementScore(input({ sessionsLast30d: 7 }));
    expect(result.score).toBe(100);
  });

  it("large values across all signals still cap at 100", () => {
    const result = computeEngagementScore(input({
      sessionsLast30d: 7,
      connectionsLast30d: 5,
      streakDays: 14,
      fcEarnedLast30d: 50,
      contributionsLast30d: 10,
    }));
    // 105 + 50 + 70 + 100 + 80 = 405 → capped at 100
    expect(result.score).toBe(100);
    expect(result.churnRisk).toBe("low");
  });

  // ── Single-signal tests — verify each weight independently ──

  it("connections-only user", () => {
    const result = computeEngagementScore(input({ connectionsLast30d: 3 }));
    expect(result.score).toBe(30);
    expect(result.churnRisk).toBe("medium");
  });

  it("streak-only user", () => {
    const result = computeEngagementScore(input({ streakDays: 4 }));
    expect(result.score).toBe(20);
    expect(result.churnRisk).toBe("medium");
  });

  it("FC-only user — low weight means lots of FC needed to move needle", () => {
    // 10 FC × 2 = 20 → medium. Shows FC alone isn't enough to indicate engagement,
    // which is intentional — earning FC without attending sessions is weak signal.
    const result = computeEngagementScore(input({ fcEarnedLast30d: 10 }));
    expect(result.score).toBe(20);
    expect(result.churnRisk).toBe("medium");
  });

  it("contributions-only user", () => {
    // 3 contributions × 8 = 24 → medium
    const result = computeEngagementScore(input({ contributionsLast30d: 3 }));
    expect(result.score).toBe(24);
    expect(result.churnRisk).toBe("medium");
  });
});
