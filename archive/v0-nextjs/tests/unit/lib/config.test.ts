import { describe, it, expect } from "vitest"
import {
  PLATFORM_FEE_2HR,
  PLATFORM_FEE_4HR,
  GST_RATE,
  platformFee,
  priceWithGST,
  gstAmount,
  getTrustTier,
  getNextTier,
  VIBE_CONFIG,
  STATUS_CONFIG,
  SESSION_STATUS_CONFIG,
  VENUE_RATING_DIMENSIONS,
  TRUST_TIER_CONFIG,
} from "@/lib/config"

describe("platformFee", () => {
  it("returns 100 for 2-hour session", () => {
    expect(platformFee(2)).toBe(100)
  })

  it("returns 150 for 4-hour session", () => {
    expect(platformFee(4)).toBe(150)
  })

  it("returns 150 for non-2-hour session (default to 4hr)", () => {
    expect(platformFee(3)).toBe(150)
    expect(platformFee(1)).toBe(150)
  })
})

describe("priceWithGST", () => {
  it("calculates 18% GST correctly", () => {
    expect(priceWithGST(100)).toBe(118)
  })

  it("handles zero amount", () => {
    expect(priceWithGST(0)).toBe(0)
  })

  it("rounds to integer", () => {
    // 250 * 1.18 = 295
    expect(priceWithGST(250)).toBe(295)
  })

  it("returns a number", () => {
    expect(typeof priceWithGST(100)).toBe("number")
  })
})

describe("gstAmount", () => {
  it("returns just the GST portion", () => {
    expect(gstAmount(100)).toBe(18)
  })

  it("handles zero", () => {
    expect(gstAmount(0)).toBe(0)
  })

  it("rounds decimal amounts", () => {
    // 250 * 0.18 = 45
    expect(gstAmount(250)).toBe(45)
  })
})

describe("getTrustTier", () => {
  it("returns New Member for 0 sessions", () => {
    expect(getTrustTier(0).label).toBe("New Member")
  })

  it("returns Rising for 5 sessions", () => {
    expect(getTrustTier(5).label).toBe("Rising")
  })

  it("returns Trusted for 15 sessions", () => {
    expect(getTrustTier(15).label).toBe("Trusted")
  })

  it("returns Community Pillar for 30 sessions", () => {
    expect(getTrustTier(30).label).toBe("Community Pillar")
  })

  it("returns OG for 100 sessions", () => {
    expect(getTrustTier(100).label).toBe("OG")
  })

  it("returns New Member as fallback for negative", () => {
    const tier = getTrustTier(-1)
    expect(tier.label).toBe("New Member")
  })
})

describe("getNextTier", () => {
  it("returns Rising for New Member", () => {
    expect(getNextTier(1)?.label).toBe("Rising")
  })

  it("returns null for OG (highest tier)", () => {
    expect(getNextTier(100)).toBeNull()
  })
})

describe("Constants", () => {
  it("PLATFORM_FEE_2HR is 100", () => {
    expect(PLATFORM_FEE_2HR).toBe(100)
  })

  it("PLATFORM_FEE_4HR is 150", () => {
    expect(PLATFORM_FEE_4HR).toBe(150)
  })

  it("GST_RATE is 0.18", () => {
    expect(GST_RATE).toBe(0.18)
  })

  it("VIBE_CONFIG has expected vibes", () => {
    expect(Object.keys(VIBE_CONFIG)).toContain("deep_focus")
    expect(Object.keys(VIBE_CONFIG)).toContain("casual_social")
    expect(Object.keys(VIBE_CONFIG)).toContain("balanced")
  })

  it("STATUS_CONFIG has all booking statuses", () => {
    const keys = Object.keys(STATUS_CONFIG)
    expect(keys).toContain("pending")
    expect(keys).toContain("paid")
    expect(keys).toContain("confirmed")
    expect(keys).toContain("cancelled")
  })

  it("SESSION_STATUS_CONFIG has all session statuses", () => {
    const keys = Object.keys(SESSION_STATUS_CONFIG)
    expect(keys).toContain("upcoming")
    expect(keys).toContain("in_progress")
    expect(keys).toContain("completed")
  })

  it("VENUE_RATING_DIMENSIONS has 7 dimensions", () => {
    expect(VENUE_RATING_DIMENSIONS).toHaveLength(7)
  })

  it("VENUE_RATING_DIMENSIONS weights sum to ~1", () => {
    const total = VENUE_RATING_DIMENSIONS.reduce((sum, d) => sum + d.weight, 0)
    expect(total).toBeCloseTo(1.0, 2)
  })

  it("TRUST_TIER_CONFIG has 5 tiers", () => {
    expect(TRUST_TIER_CONFIG).toHaveLength(5)
  })

  it("TRUST_TIER_CONFIG covers all ranges", () => {
    expect(TRUST_TIER_CONFIG[0].min).toBe(0)
    expect(TRUST_TIER_CONFIG[TRUST_TIER_CONFIG.length - 1].max).toBe(Infinity)
  })
})
