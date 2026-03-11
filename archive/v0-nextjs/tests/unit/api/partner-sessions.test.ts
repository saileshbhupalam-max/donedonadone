import { describe, it, expect } from "vitest"

// Test partner session update field whitelist logic

describe("Partner Session Field Whitelist", () => {
  const ALLOWED_FIELDS = [
    "date", "start_time", "end_time", "duration_hours",
    "venue_price", "max_spots", "status",
  ] as const

  function applyWhitelist(body: Record<string, unknown>) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }
    return updates
  }

  it("allows valid fields through", () => {
    const body = { date: "2025-03-01", venue_price: 200, max_spots: 10 }
    const result = applyWhitelist(body)
    expect(result.date).toBe("2025-03-01")
    expect(result.venue_price).toBe(200)
    expect(result.max_spots).toBe(10)
  })

  it("blocks disallowed fields", () => {
    const body = {
      date: "2025-03-01",
      id: "injected-id",
      venue_id: "injected-venue",
      platform_fee: 0,
      total_price: 0,
    }
    const result = applyWhitelist(body)
    expect(result.date).toBe("2025-03-01")
    expect(result).not.toHaveProperty("id")
    expect(result).not.toHaveProperty("venue_id")
    expect(result).not.toHaveProperty("platform_fee")
    expect(result).not.toHaveProperty("total_price")
  })

  it("always includes updated_at", () => {
    const result = applyWhitelist({})
    expect(result).toHaveProperty("updated_at")
  })

  it("ignores __proto__ injection", () => {
    const body = { __proto__: { admin: true }, date: "2025-03-01" }
    const result = applyWhitelist(body)
    expect(result).not.toHaveProperty("__proto__")
    expect(result).not.toHaveProperty("admin")
  })

  it("ignores constructor injection", () => {
    const body = { constructor: "evil", date: "2025-03-01" }
    const result = applyWhitelist(body)
    expect(result).not.toHaveProperty("constructor")
  })

  it("handles empty body", () => {
    const result = applyWhitelist({})
    // Only updated_at should be present
    expect(Object.keys(result)).toEqual(["updated_at"])
  })
})
