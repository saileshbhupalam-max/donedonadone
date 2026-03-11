import { describe, it, expect } from "vitest"
import { moderateText, sanitizeDisplayName } from "@/lib/moderation"

describe("moderateText", () => {
  it("returns clean:true for normal text", () => {
    expect(moderateText("I love working from cafes")).toEqual({ clean: true })
  })

  it("returns clean:true for empty string", () => {
    expect(moderateText("")).toEqual({ clean: true })
  })

  it("returns clean:true for whitespace-only", () => {
    expect(moderateText("   ")).toEqual({ clean: true })
  })

  it("flags offensive words", () => {
    const result = moderateText("this is shit")
    expect(result.clean).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it("flags offensive words case-insensitively", () => {
    const result = moderateText("This is SHIT")
    expect(result.clean).toBe(false)
  })

  it("catches phone numbers (10+ digits)", () => {
    const result = moderateText("Call me at 9876543210")
    expect(result.clean).toBe(false)
  })

  it("catches email addresses", () => {
    const result = moderateText("Email me at user@example.com")
    expect(result.clean).toBe(false)
  })

  it("catches URLs", () => {
    const result = moderateText("Check out https://example.com")
    expect(result.clean).toBe(false)
  })

  it("catches WhatsApp links", () => {
    const result = moderateText("Msg me on wa.me/1234567890")
    expect(result.clean).toBe(false)
  })

  it("catches Telegram links", () => {
    const result = moderateText("Join t.me/mygroup")
    expect(result.clean).toBe(false)
  })

  it("allows normal text with numbers", () => {
    expect(moderateText("I work 8 hours a day").clean).toBe(true)
  })

  it("allows text with short numbers", () => {
    expect(moderateText("I booked table 5").clean).toBe(true)
  })

  // Regression: ensure global regex doesn't break on consecutive calls
  it("works correctly on consecutive calls", () => {
    const result1 = moderateText("this is shit")
    const result2 = moderateText("this is clean text")
    const result3 = moderateText("another shit post")
    expect(result1.clean).toBe(false)
    expect(result2.clean).toBe(true)
    expect(result3.clean).toBe(false)
  })
})

describe("sanitizeDisplayName", () => {
  it("trims whitespace", () => {
    expect(sanitizeDisplayName("  Alice  ")).toBe("Alice")
  })

  it("removes HTML tags", () => {
    expect(sanitizeDisplayName("<script>alert('xss')</script>Alice")).toBe("alert('xss')Alice")
  })

  it("truncates to 50 characters", () => {
    const longName = "A".repeat(100)
    expect(sanitizeDisplayName(longName)).toHaveLength(50)
  })

  it("handles empty input", () => {
    expect(sanitizeDisplayName("")).toBe("")
  })

  it("preserves normal names", () => {
    expect(sanitizeDisplayName("Sailesh B")).toBe("Sailesh B")
  })
})
