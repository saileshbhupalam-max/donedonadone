import { describe, it, expect } from "vitest";
import {
  getRankForHours,
  getNextRank,
  getRankProgress,
  calculateSessionHours,
  RANK_TIERS,
} from "@/lib/ranks";

describe("getRankForHours edge cases", () => {
  it("returns Newcomer for negative hours", () => {
    // Iterates from end: -1 >= 150? no, >= 75? no ... >= 0? no. Falls through to RANK_TIERS[0]
    expect(getRankForHours(-1).name).toBe("Newcomer");
  });

  it("returns Newcomer for exactly 0 hours", () => {
    expect(getRankForHours(0).name).toBe("Newcomer");
  });

  it("returns Getting Started for exactly 5 hours (boundary)", () => {
    expect(getRankForHours(5).name).toBe("Getting Started");
  });

  it("returns Newcomer for 4.99 hours (just below boundary)", () => {
    expect(getRankForHours(4.99).name).toBe("Newcomer");
  });

  it("returns Regular for exactly 15 hours", () => {
    expect(getRankForHours(15).name).toBe("Regular");
  });

  it("returns Deep Worker for exactly 35 hours", () => {
    expect(getRankForHours(35).name).toBe("Deep Worker");
  });

  it("returns Elite for exactly 75 hours", () => {
    expect(getRankForHours(75).name).toBe("Elite");
  });

  it("returns Grandmaster for exactly 150 hours", () => {
    expect(getRankForHours(150).name).toBe("Grandmaster");
  });

  it("returns Grandmaster for extremely large hours", () => {
    expect(getRankForHours(999999).name).toBe("Grandmaster");
  });

  it("returns Newcomer for NaN hours (falls through all comparisons)", () => {
    // NaN >= any number is always false, so falls to RANK_TIERS[0]
    expect(getRankForHours(NaN).name).toBe("Newcomer");
  });
});

describe("getNextRank edge cases", () => {
  it("returns null when at Grandmaster (last tier)", () => {
    expect(getNextRank(150)).toBeNull();
  });

  it("returns Getting Started when at Newcomer", () => {
    expect(getNextRank(0)!.name).toBe("Getting Started");
  });
});

describe("getRankProgress edge cases", () => {
  it("returns progress 100 and hoursToNext 0 at Grandmaster", () => {
    const result = getRankProgress(200);
    expect(result.progress).toBe(100);
    expect(result.hoursToNext).toBe(0);
    expect(result.next).toBeNull();
    expect(result.current.name).toBe("Grandmaster");
  });

  it("returns progress 0 at exactly 0 hours", () => {
    const result = getRankProgress(0);
    expect(result.progress).toBe(0);
    expect(result.current.name).toBe("Newcomer");
    expect(result.next!.name).toBe("Getting Started");
    expect(result.hoursToNext).toBe(5);
  });

  it("returns correct progress mid-tier", () => {
    // Newcomer: 0-5, at 2.5 hours = 50%
    const result = getRankProgress(2.5);
    expect(result.progress).toBe(50);
    expect(result.hoursToNext).toBe(2.5);
  });

  it("returns 100% progress at exactly Grandmaster boundary (150)", () => {
    const result = getRankProgress(150);
    expect(result.progress).toBe(100);
    expect(result.hoursToNext).toBe(0);
  });
});

describe("calculateSessionHours edge cases", () => {
  it("returns 2 for '10:00 AM' to '12:00 PM'", () => {
    expect(calculateSessionHours("10:00 AM", "12:00 PM", "Session")).toBe(2);
  });

  it("returns 4 for '9 am' to '1 pm'", () => {
    // parseTime: '9 am' => h=9, am => 9, '1 pm' => h=1, pm => 13, diff=4
    expect(calculateSessionHours("9 am", "1 pm", "Session")).toBe(4);
  });

  it("returns 2 for '10:00' to '12:00' (24hr format)", () => {
    expect(calculateSessionHours("10:00", "12:00", "Session")).toBe(2);
  });

  it("returns default 2 when startTime is null", () => {
    expect(calculateSessionHours(null, "12:00 PM", "Session")).toBe(2);
  });

  it("returns 3 for title containing 'Deep Focus 4hr Session'", () => {
    expect(calculateSessionHours(null, null, "Deep Focus 4hr Session")).toBe(3);
  });

  it("returns 1.33 for title containing 'Quick 2 hour'", () => {
    expect(calculateSessionHours(null, null, "Quick 2 hour")).toBe(1.33);
  });

  it("returns default 2 for title with no time indicator and no times", () => {
    expect(calculateSessionHours(null, null, "Morning Meetup")).toBe(2);
  });

  it("returns 3 when sessionFormat is 'structured_4hr' regardless of times", () => {
    expect(calculateSessionHours("10:00 AM", "11:00 AM", "Whatever", "structured_4hr")).toBe(3);
  });

  it("returns 1.33 when sessionFormat is 'structured_2hr' regardless of times", () => {
    expect(calculateSessionHours("10:00 AM", "2:00 PM", "Whatever", "structured_2hr")).toBe(1.33);
  });

  it("falls back to 2 when time diff is negative (end before start without AM/PM)", () => {
    // e.g. "14:00" to "10:00" => diff = -4, negative => fallback 2
    expect(calculateSessionHours("14:00", "10:00", "Session")).toBe(2);
  });

  it("handles '12:00 AM' to '2:00 AM' (midnight to 2am)", () => {
    // '12:00 AM' => h=12, am && h===12 => h=0, '2:00 AM' => h=2
    // diff = 2 - 0 = 2
    expect(calculateSessionHours("12:00 AM", "2:00 AM", "Session")).toBe(2);
  });

  it("handles empty string title", () => {
    expect(calculateSessionHours(null, null, "")).toBe(2);
  });
});
