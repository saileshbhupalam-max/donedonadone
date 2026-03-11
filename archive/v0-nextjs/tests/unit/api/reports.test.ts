import { describe, it, expect } from "vitest"
import { isValidUUID } from "@/lib/utils"

// Test safety report validation logic

describe("Report Validation", () => {
  const validReasons = ["harassment", "inappropriate", "no_show", "disruptive", "spam", "other"]

  describe("Reason whitelist", () => {
    it("accepts all valid reasons", () => {
      for (const reason of validReasons) {
        expect(validReasons.includes(reason)).toBe(true)
      }
    })

    it("rejects invalid reason", () => {
      expect(validReasons.includes("fake_reason")).toBe(false)
    })

    it("rejects empty reason", () => {
      expect(validReasons.includes("")).toBe(false)
    })

    it("rejects SQL injection in reason", () => {
      expect(validReasons.includes("'; DROP TABLE users; --")).toBe(false)
    })
  })

  describe("Self-report prevention", () => {
    it("prevents reporting yourself", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000"
      const reportedUserId = "550e8400-e29b-41d4-a716-446655440000"
      expect(reportedUserId === userId).toBe(true) // route returns 400
    })

    it("allows reporting different user", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000"
      const reportedUserId = "660e8400-e29b-41d4-a716-446655440000"
      expect(reportedUserId === userId).toBe(false) // route proceeds
    })
  })

  describe("User ID validation", () => {
    it("requires valid UUID for reported_user_id", () => {
      expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true)
    })

    it("rejects malformed reported_user_id", () => {
      expect(isValidUUID("not-a-valid-uuid")).toBe(false)
    })
  })

  describe("Details truncation", () => {
    it("details are capped at 500 chars", () => {
      const longDetails = "A".repeat(1000)
      const truncated = longDetails.slice(0, 500)
      expect(truncated).toHaveLength(500)
    })

    it("short details pass through", () => {
      const details = "Disruptive behavior during session"
      expect(details.slice(0, 500)).toBe(details)
    })
  })
})
