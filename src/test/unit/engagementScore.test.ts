import { describe, it, expect } from "vitest";
import { computeEngagementScore } from "@/lib/engagementScore";

describe("computeEngagementScore", () => {
  it("scores 0 with no activity → high risk", () => {
    const result = computeEngagementScore({ sessionsLast30d: 0, connectionsLast30d: 0, streakDays: 0 });
    expect(result.score).toBe(0);
    expect(result.churnRisk).toBe("high");
  });

  it("formula: (sessions×15) + (connections×10) + (streak×5)", () => {
    const result = computeEngagementScore({ sessionsLast30d: 2, connectionsLast30d: 1, streakDays: 3 });
    expect(result.score).toBe(2 * 15 + 1 * 10 + 3 * 5); // 30 + 10 + 15 = 55
  });

  it("1 session, 0 connections, 0 streak → 15, high risk", () => {
    const result = computeEngagementScore({ sessionsLast30d: 1, connectionsLast30d: 0, streakDays: 0 });
    expect(result.score).toBe(15);
    expect(result.churnRisk).toBe("high");
  });

  it("score 19 → high risk (boundary)", () => {
    // Need score < 20 → 1 session + 0 connections + 0 streak = 15
    const result = computeEngagementScore({ sessionsLast30d: 1, connectionsLast30d: 0, streakDays: 0 });
    expect(result.score).toBe(15);
    expect(result.churnRisk).toBe("high");
  });

  it("score exactly 20 → medium risk (boundary)", () => {
    // 1 session(15) + 0 connections + 1 streak(5) = 20
    const result = computeEngagementScore({ sessionsLast30d: 1, connectionsLast30d: 0, streakDays: 1 });
    expect(result.score).toBe(20);
    expect(result.churnRisk).toBe("medium");
  });

  it("score 49 → medium risk (boundary)", () => {
    // 3 sessions(45) + 0 connections + 0 streak = 45
    const result = computeEngagementScore({ sessionsLast30d: 3, connectionsLast30d: 0, streakDays: 0 });
    expect(result.score).toBe(45);
    expect(result.churnRisk).toBe("medium");
  });

  it("score exactly 50 → low risk (boundary)", () => {
    // 2 sessions(30) + 2 connections(20) + 0 streak = 50
    const result = computeEngagementScore({ sessionsLast30d: 2, connectionsLast30d: 2, streakDays: 0 });
    expect(result.score).toBe(50);
    expect(result.churnRisk).toBe("low");
  });

  it("score caps at 100", () => {
    // 7 sessions(105) → should cap at 100
    const result = computeEngagementScore({ sessionsLast30d: 7, connectionsLast30d: 0, streakDays: 0 });
    expect(result.score).toBe(100);
  });

  it("large values still cap at 100", () => {
    const result = computeEngagementScore({ sessionsLast30d: 7, connectionsLast30d: 5, streakDays: 14 });
    // 105 + 50 + 70 = 225 → capped at 100
    expect(result.score).toBe(100);
    expect(result.churnRisk).toBe("low");
  });

  it("connections-only user", () => {
    const result = computeEngagementScore({ sessionsLast30d: 0, connectionsLast30d: 3, streakDays: 0 });
    expect(result.score).toBe(30);
    expect(result.churnRisk).toBe("medium");
  });

  it("streak-only user", () => {
    const result = computeEngagementScore({ sessionsLast30d: 0, connectionsLast30d: 0, streakDays: 4 });
    expect(result.score).toBe(20);
    expect(result.churnRisk).toBe("medium");
  });
});
