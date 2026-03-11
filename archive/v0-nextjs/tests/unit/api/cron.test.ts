import { describe, it, expect } from "vitest"
import { timingSafeEqual } from "crypto"

// Test the safeCompare function logic (extracted from cron route)
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

describe("Cron Auth — safeCompare", () => {
  it("returns true for matching strings", () => {
    expect(safeCompare("Bearer test-secret", "Bearer test-secret")).toBe(true)
  })

  it("returns false for different strings of same length", () => {
    expect(safeCompare("Bearer test-secret", "Bearer test-secreT")).toBe(false)
  })

  it("returns false for different length strings", () => {
    expect(safeCompare("short", "a-much-longer-string")).toBe(false)
  })

  it("returns false for empty vs non-empty", () => {
    expect(safeCompare("", "something")).toBe(false)
  })

  it("returns true for empty vs empty", () => {
    expect(safeCompare("", "")).toBe(true)
  })

  it("handles special characters", () => {
    const secret = "abc!@#$%^&*()_+=-"
    expect(safeCompare(`Bearer ${secret}`, `Bearer ${secret}`)).toBe(true)
  })
})

describe("Cron Auth — request validation", () => {
  const CRON_SECRET = "test-cron-secret-that-is-long-enough"

  it("rejects missing authorization header", () => {
    const authHeader = ""
    const expected = `Bearer ${CRON_SECRET}`
    expect(safeCompare(authHeader, expected)).toBe(false)
  })

  it("rejects wrong secret", () => {
    const authHeader = "Bearer wrong-secret-value-xxxx"
    const expected = `Bearer ${CRON_SECRET}`
    // Different length → fails fast
    expect(safeCompare(authHeader, expected)).toBe(false)
  })

  it("accepts correct Bearer token", () => {
    const authHeader = `Bearer ${CRON_SECRET}`
    const expected = `Bearer ${CRON_SECRET}`
    expect(safeCompare(authHeader, expected)).toBe(true)
  })

  it("rejects Bearer token without space", () => {
    const authHeader = `Bearer${CRON_SECRET}`
    const expected = `Bearer ${CRON_SECRET}`
    expect(safeCompare(authHeader, expected)).toBe(false)
  })
})
