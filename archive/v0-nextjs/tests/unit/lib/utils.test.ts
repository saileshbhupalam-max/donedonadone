import { describe, it, expect } from "vitest"
import { isValidUUID, cn } from "@/lib/utils"

describe("isValidUUID", () => {
  it("returns true for valid v4 UUID", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true)
  })

  it("returns true for uppercase UUID", () => {
    expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true)
  })

  it("returns true for mixed case UUID", () => {
    expect(isValidUUID("550e8400-E29B-41d4-a716-446655440000")).toBe(true)
  })

  it("returns false for empty string", () => {
    expect(isValidUUID("")).toBe(false)
  })

  it("returns false for random string", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false)
  })

  it("returns false for partial UUID", () => {
    expect(isValidUUID("550e8400-e29b-41d4")).toBe(false)
  })

  it("returns false for UUID with extra chars", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000-extra")).toBe(false)
  })

  it("returns false for SQL injection attempt", () => {
    expect(isValidUUID("'; DROP TABLE bookings; --")).toBe(false)
  })

  it("returns false for XSS payload", () => {
    expect(isValidUUID("<script>alert('xss')</script>")).toBe(false)
  })
})

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible")
  })

  it("deduplicates tailwind classes", () => {
    const result = cn("p-4", "p-2")
    expect(result).toBe("p-2")
  })

  it("handles empty input", () => {
    expect(cn()).toBe("")
  })
})
