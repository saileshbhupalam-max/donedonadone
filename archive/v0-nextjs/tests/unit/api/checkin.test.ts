// Tests for the haversine distance calculation and check-in geolocation logic
// We test the pure function directly since API routes require full Supabase mocking

import { describe, it, expect } from "vitest"

// Extract haversine from the route file for testing
// Since it's not exported, we re-implement the exact same function here for verification
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371e3 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const MAX_CHECKIN_DISTANCE_M = 500

describe("Haversine Distance", () => {
  it("returns 0 for same point", () => {
    const d = haversineDistance(12.9116, 77.6389, 12.9116, 77.6389)
    expect(d).toBeCloseTo(0, 0)
  })

  it("is symmetric (A→B == B→A)", () => {
    const d1 = haversineDistance(12.9116, 77.6389, 12.9200, 77.6400)
    const d2 = haversineDistance(12.9200, 77.6400, 12.9116, 77.6389)
    expect(d1).toBeCloseTo(d2, 5)
  })

  // HSR Layout BDA Complex to 27th Main: ~500m
  it("calculates known HSR Layout distance roughly correctly", () => {
    // BDA Complex: 12.9116, 77.6389
    // 27th Main: 12.9150, 77.6350 (approx)
    const d = haversineDistance(12.9116, 77.6389, 12.9150, 77.6350)
    expect(d).toBeGreaterThan(300)
    expect(d).toBeLessThan(700)
  })

  // Very far apart — e.g., Bangalore to Mumbai (~840km)
  it("handles large distances", () => {
    const d = haversineDistance(12.9716, 77.5946, 19.0760, 72.8777)
    expect(d).toBeGreaterThan(800_000) // > 800km
    expect(d).toBeLessThan(1_000_000) // < 1000km
  })

  // Equator and poles
  it("handles equatorial points", () => {
    const d = haversineDistance(0, 0, 0, 1)
    // 1 degree longitude at equator ≈ 111km
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
})

describe("Check-in distance validation", () => {
  it("allows check-in within 500m", () => {
    // Two points ~200m apart in HSR Layout
    const distance = haversineDistance(12.9116, 77.6389, 12.9125, 77.6392)
    expect(distance).toBeLessThan(MAX_CHECKIN_DISTANCE_M)
  })

  it("rejects check-in beyond 500m", () => {
    // Two points ~2km apart
    const distance = haversineDistance(12.9116, 77.6389, 12.9300, 77.6400)
    expect(distance).toBeGreaterThan(MAX_CHECKIN_DISTANCE_M)
  })
})
