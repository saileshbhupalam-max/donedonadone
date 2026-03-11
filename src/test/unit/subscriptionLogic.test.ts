import { describe, it, expect } from "vitest";
import { hasFeature, getLimit, resolveEffectiveTier } from "@/lib/subscriptionLogic";
import type { TierInfo, TierFeature, TierLimit } from "@/lib/subscriptionLogic";

const TIERS: TierInfo[] = [
  { id: "free", name: "Explorer", sort_order: 0, is_active: true },
  { id: "plus", name: "Plus", sort_order: 10, is_active: true },
  { id: "pro", name: "Pro", sort_order: 20, is_active: true },
  { id: "max", name: "Max", sort_order: 30, is_active: true },
];

const FEATURES: TierFeature[] = [
  { feature_key: "match_reasons", min_tier_id: "plus", is_active: true },
  { feature_key: "company_matching", min_tier_id: "pro", is_active: true },
  { feature_key: "cross_space_network", min_tier_id: "max", is_active: true },
  { feature_key: "basic_discovery", min_tier_id: "free", is_active: true },
  { feature_key: "disabled_feature", min_tier_id: "free", is_active: false },
];

const LIMITS: TierLimit[] = [
  { tier_id: "free", limit_key: "connections_per_week", limit_value: 5 },
  { tier_id: "plus", limit_key: "connections_per_week", limit_value: 20 },
  { tier_id: "pro", limit_key: "connections_per_week", limit_value: 50 },
  { tier_id: "max", limit_key: "connections_per_week", limit_value: -1 },
  { tier_id: "free", limit_key: "coffee_roulette_per_week", limit_value: 1 },
  { tier_id: "plus", limit_key: "coffee_roulette_per_week", limit_value: 3 },
  { tier_id: "pro", limit_key: "company_intros_per_month", limit_value: 5 },
  { tier_id: "max", limit_key: "company_intros_per_month", limit_value: -1 },
];

describe("hasFeature", () => {
  it("free user can access free-tier features", () => {
    expect(hasFeature("basic_discovery", 0, FEATURES, TIERS)).toBe(true);
  });

  it("free user cannot access plus features", () => {
    expect(hasFeature("match_reasons", 0, FEATURES, TIERS)).toBe(false);
  });

  it("free user cannot access pro features", () => {
    expect(hasFeature("company_matching", 0, FEATURES, TIERS)).toBe(false);
  });

  it("free user cannot access max features", () => {
    expect(hasFeature("cross_space_network", 0, FEATURES, TIERS)).toBe(false);
  });

  it("plus user can access free + plus features", () => {
    expect(hasFeature("basic_discovery", 10, FEATURES, TIERS)).toBe(true);
    expect(hasFeature("match_reasons", 10, FEATURES, TIERS)).toBe(true);
  });

  it("plus user cannot access pro features", () => {
    expect(hasFeature("company_matching", 10, FEATURES, TIERS)).toBe(false);
  });

  it("pro user can access free + plus + pro features", () => {
    expect(hasFeature("basic_discovery", 20, FEATURES, TIERS)).toBe(true);
    expect(hasFeature("match_reasons", 20, FEATURES, TIERS)).toBe(true);
    expect(hasFeature("company_matching", 20, FEATURES, TIERS)).toBe(true);
  });

  it("pro user cannot access max features", () => {
    expect(hasFeature("cross_space_network", 20, FEATURES, TIERS)).toBe(false);
  });

  it("max user can access all features", () => {
    expect(hasFeature("basic_discovery", 30, FEATURES, TIERS)).toBe(true);
    expect(hasFeature("match_reasons", 30, FEATURES, TIERS)).toBe(true);
    expect(hasFeature("company_matching", 30, FEATURES, TIERS)).toBe(true);
    expect(hasFeature("cross_space_network", 30, FEATURES, TIERS)).toBe(true);
  });

  it("unknown feature key returns false for all tiers", () => {
    expect(hasFeature("nonexistent_feature", 30, FEATURES, TIERS)).toBe(false);
  });

  it("feature with unknown min_tier_id returns false", () => {
    const feats = [{ feature_key: "orphan", min_tier_id: "ultra", is_active: true }];
    expect(hasFeature("orphan", 30, feats, TIERS)).toBe(false);
  });
});

describe("getLimit", () => {
  it("returns correct limit for free tier", () => {
    expect(getLimit("connections_per_week", "free", LIMITS)).toBe(5);
  });

  it("returns correct limit for plus tier", () => {
    expect(getLimit("connections_per_week", "plus", LIMITS)).toBe(20);
  });

  it("returns -1 for unlimited (max tier)", () => {
    expect(getLimit("connections_per_week", "max", LIMITS)).toBe(-1);
  });

  it("returns 0 for unknown limit key", () => {
    expect(getLimit("nonexistent_limit", "free", LIMITS)).toBe(0);
  });

  it("returns 0 for limit not defined on the current tier", () => {
    expect(getLimit("company_intros_per_month", "free", LIMITS)).toBe(0);
  });

  it("returns correct limit for different keys on same tier", () => {
    expect(getLimit("connections_per_week", "free", LIMITS)).toBe(5);
    expect(getLimit("coffee_roulette_per_week", "free", LIMITS)).toBe(1);
  });
});

describe("resolveEffectiveTier", () => {
  it("returns subscription tier when no boost", () => {
    expect(resolveEffectiveTier(10, null, null)).toBe(10);
  });

  it("returns boost tier when higher than subscription and not expired", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(resolveEffectiveTier(0, 20, future)).toBe(20);
  });

  it("returns subscription tier when boost has expired", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(resolveEffectiveTier(10, 20, past)).toBe(10);
  });

  it("returns subscription tier when boost is lower", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(resolveEffectiveTier(20, 10, future)).toBe(20);
  });

  it("returns boost tier when equal to subscription", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(resolveEffectiveTier(10, 10, future)).toBe(10);
  });
});
