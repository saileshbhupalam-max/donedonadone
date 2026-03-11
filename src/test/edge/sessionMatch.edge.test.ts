import { describe, it, expect } from "vitest";
import { sessionMatchScore } from "@/lib/sessionMatch";

describe("sessionMatchScore edge cases", () => {
  describe("time slot parsing", () => {
    it("parses '10:00 AM' as morning", () => {
      const score = sessionMatchScore(
        { date: "2026-06-15", start_time: "10:00 AM" },
        { preferred_times: ["morning"] }
      );
      expect(score).toBe(25);
    });

    it("parses '10:00 am' (lowercase) as morning", () => {
      const score = sessionMatchScore(
        { date: "2026-06-15", start_time: "10:00 am" },
        { preferred_times: ["morning"] }
      );
      expect(score).toBe(25);
    });

    it("parses '10 AM' (no minutes) as morning", () => {
      // regex matches first digits, gets 10, then checks for pm/am
      const score = sessionMatchScore(
        { date: "2026-06-15", start_time: "10 AM" },
        { preferred_times: ["morning"] }
      );
      expect(score).toBe(25);
    });

    it("parses '22:00' (24hr format) as evening", () => {
      // regex matches 22, no am/pm => hour=22, >= 17 => evening
      const score = sessionMatchScore(
        { date: "2026-06-15", start_time: "22:00" },
        { preferred_times: ["evening"] }
      );
      expect(score).toBe(25);
    });

    it("parses '10:00' (24hr, no am/pm) as morning", () => {
      // regex matches 10, no am/pm => hour=10, >= 5 && < 12 => morning
      const score = sessionMatchScore(
        { date: "2026-06-15", start_time: "10:00" },
        { preferred_times: ["morning"] }
      );
      expect(score).toBe(25);
    });

    it("'12:00 AM' is parsed as hour 0 which is evening (>= 17 or < 5)", () => {
      // hour=12, am && hour===12 => hour=0, 0 < 5 => evening
      const score = sessionMatchScore(
        { date: "2026-06-15", start_time: "12:00 AM" },
        { preferred_times: ["evening"] }
      );
      expect(score).toBe(25);
    });

    it("'12:00 AM' does NOT match morning", () => {
      const score = sessionMatchScore(
        { date: "2026-06-15", start_time: "12:00 AM" },
        { preferred_times: ["morning"] }
      );
      expect(score).toBe(0);
    });

    it("'12:00 PM' is parsed as hour 12 which is afternoon (>= 12 && < 17)", () => {
      const score = sessionMatchScore(
        { date: "2026-06-15", start_time: "12:00 PM" },
        { preferred_times: ["afternoon"] }
      );
      expect(score).toBe(25);
    });
  });

  describe("preferred days", () => {
    it("gives no day bonus when preferred_days is empty array", () => {
      const score = sessionMatchScore(
        { date: "2026-06-15" }, // a Monday
        { preferred_days: [] }
      );
      expect(score).toBe(0);
    });

    it("matches the correct day of week", () => {
      // 2026-06-15 is a Monday
      const score = sessionMatchScore(
        { date: "2026-06-15" },
        { preferred_days: ["monday"] }
      );
      expect(score).toBe(25);
    });

    it("does not match wrong day", () => {
      const score = sessionMatchScore(
        { date: "2026-06-15" }, // Monday
        { preferred_days: ["tuesday"] }
      );
      expect(score).toBe(0);
    });
  });

  describe("distance and radius", () => {
    it("gives radius bonus when distance_km is 0 (at venue)", () => {
      const score = sessionMatchScore(
        { date: "2026-06-15", distance_km: 0 },
        { preferred_radius_km: 5 }
      );
      expect(score).toBe(30);
    });

    it("gives radius bonus when distance_km equals preferred_radius_km exactly", () => {
      const score = sessionMatchScore(
        { date: "2026-06-15", distance_km: 5 },
        { preferred_radius_km: 5 }
      );
      expect(score).toBe(30);
    });

    it("gives NO radius bonus when distance_km exceeds preferred_radius_km by 0.01", () => {
      const score = sessionMatchScore(
        { date: "2026-06-15", distance_km: 5.01 },
        { preferred_radius_km: 5 }
      );
      expect(score).toBe(0);
    });

    it("gives no radius bonus when distance_km is null", () => {
      const score = sessionMatchScore(
        { date: "2026-06-15" },
        { preferred_radius_km: 5 }
      );
      expect(score).toBe(0);
    });

    it("gives no radius bonus when preferred_radius_km is undefined", () => {
      const score = sessionMatchScore(
        { date: "2026-06-15", distance_km: 1 },
        {}
      );
      expect(score).toBe(0);
    });
  });

  describe("empty preferences", () => {
    it("returns 0 when prefs is completely empty", () => {
      const score = sessionMatchScore(
        { date: "2026-06-15", start_time: "10:00 AM", distance_km: 1, session_format: "structured_2hr" },
        {}
      );
      expect(score).toBe(0);
    });
  });

  describe("maximum score", () => {
    it("returns 100 when all criteria match", () => {
      // 2026-06-15 is Monday
      const score = sessionMatchScore(
        {
          date: "2026-06-15",
          start_time: "10:00 AM",
          distance_km: 1,
          session_format: "structured_2hr",
        },
        {
          preferred_days: ["monday"],
          preferred_times: ["morning"],
          preferred_radius_km: 5,
          work_vibe: "balanced", // balanced maps to casual, structured_2hr
          preferred_session_duration: 2,
        }
      );
      // 30 (radius) + 25 (day) + 25 (time) + 10 (vibe) + 10 (duration) = 100
      expect(score).toBe(100);
    });
  });
});
