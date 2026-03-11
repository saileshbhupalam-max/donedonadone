import { describe, it, expect } from "vitest";
import { BADGE_DEFINITIONS, getBadgeDef } from "@/lib/badges";

describe("BADGE_DEFINITIONS edge cases", () => {
  it("every badge type is unique (no duplicates)", () => {
    const types = BADGE_DEFINITIONS.map(b => b.type);
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(types.length);
  });

  it("no two badges share the same type string", () => {
    const seen = new Map<string, string>();
    for (const badge of BADGE_DEFINITIONS) {
      if (seen.has(badge.type)) {
        throw new Error(`Duplicate badge type: "${badge.type}" used by both "${seen.get(badge.type)}" and "${badge.name}"`);
      }
      seen.set(badge.type, badge.name);
    }
    expect(seen.size).toBe(BADGE_DEFINITIONS.length);
  });

  it("all emoji fields are non-empty strings", () => {
    for (const badge of BADGE_DEFINITIONS) {
      expect(badge.emoji, `Badge "${badge.type}" has empty emoji`).toBeTruthy();
      expect(typeof badge.emoji).toBe("string");
      expect(badge.emoji.length).toBeGreaterThan(0);
    }
  });

  it("all badges have non-empty hint text", () => {
    for (const badge of BADGE_DEFINITIONS) {
      expect(badge.hint, `Badge "${badge.type}" has empty hint`).toBeTruthy();
      expect(typeof badge.hint).toBe("string");
      expect(badge.hint.length).toBeGreaterThan(0);
    }
  });

  it("all badges have non-empty name and description", () => {
    for (const badge of BADGE_DEFINITIONS) {
      expect(badge.name, `Badge "${badge.type}" has empty name`).toBeTruthy();
      expect(badge.description, `Badge "${badge.type}" has empty description`).toBeTruthy();
    }
  });

  it("beloved badge description mentions BOTH 50 props AND 10 unique givers", () => {
    const beloved = BADGE_DEFINITIONS.find(b => b.type === "beloved");
    expect(beloved).toBeDefined();
    expect(beloved!.description).toContain("50+");
    expect(beloved!.description).toContain("10+");
  });

  it("has exactly 17 badge definitions", () => {
    expect(BADGE_DEFINITIONS).toHaveLength(17);
  });
});

describe("getBadgeDef edge cases", () => {
  it("returns undefined for non-existent badge type", () => {
    expect(getBadgeDef("nonexistent")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getBadgeDef("")).toBeUndefined();
  });

  it("returns correct badge for each defined type", () => {
    for (const badge of BADGE_DEFINITIONS) {
      const result = getBadgeDef(badge.type);
      expect(result).toBeDefined();
      expect(result!.type).toBe(badge.type);
      expect(result!.name).toBe(badge.name);
    }
  });

  it("is case-sensitive (EARLY_ADOPTER does not match early_adopter)", () => {
    expect(getBadgeDef("EARLY_ADOPTER")).toBeUndefined();
    expect(getBadgeDef("early_adopter")).toBeDefined();
  });
});
