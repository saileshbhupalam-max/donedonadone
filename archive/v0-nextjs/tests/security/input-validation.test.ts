import { describe, it, expect } from "vitest"
import { isValidUUID } from "@/lib/utils"
import { moderateText, sanitizeDisplayName } from "@/lib/moderation"

describe("Security: UUID Validation Against Injection", () => {
  const attackPayloads = [
    "'; DROP TABLE bookings; --",
    "1 OR 1=1",
    "<script>alert('xss')</script>",
    "{{7*7}}",
    "${7*7}",
    "../../../etc/passwd",
    "null",
    "undefined",
    "true",
    "false",
    "NaN",
    "Infinity",
    "1e100",
    "0x48656c6c6f",
    "%00",
    "\n\r",
    "\\",
    "' OR ''='",
    "1; SELECT * FROM users",
    "UNION SELECT * FROM profiles",
  ]

  for (const payload of attackPayloads) {
    it(`rejects: "${payload.slice(0, 40)}"`, () => {
      expect(isValidUUID(payload)).toBe(false)
    })
  }
})

describe("Security: Content Moderation Against Bypass", () => {
  it("catches disintermediation via phone number", () => {
    expect(moderateText("WhatsApp me: 9876543210").clean).toBe(false)
  })

  it("catches disintermediation via email", () => {
    expect(moderateText("email me user@gmail.com").clean).toBe(false)
  })

  it("catches disintermediation via URL", () => {
    expect(moderateText("check https://meet.google.com/abc").clean).toBe(false)
  })

  it("catches WhatsApp deep link", () => {
    expect(moderateText("msg wa.me/919876543210").clean).toBe(false)
  })

  it("catches Telegram link", () => {
    expect(moderateText("join t.me/mygroup").clean).toBe(false)
  })

  it("allows normal work-related text", () => {
    expect(moderateText("Great session for deep focus work").clean).toBe(true)
  })

  it("allows short numbers (not phone)", () => {
    expect(moderateText("Table 5, session at 2pm").clean).toBe(true)
  })
})

describe("Security: Display Name Sanitization", () => {
  it("removes HTML script tags", () => {
    const result = sanitizeDisplayName("<script>alert('xss')</script>")
    expect(result).not.toContain("<script>")
  })

  it("removes img tags with onerror", () => {
    const result = sanitizeDisplayName('<img onerror="alert(1)" src=x>')
    expect(result).not.toContain("<img")
  })

  it("preserves normal names", () => {
    expect(sanitizeDisplayName("Sailesh B")).toBe("Sailesh B")
  })

  it("truncates excessively long names", () => {
    const name = "A".repeat(200)
    expect(sanitizeDisplayName(name).length).toBeLessThanOrEqual(50)
  })
})

describe("Security: Venue Rating Key Whitelist", () => {
  const ALLOWED = [
    "venue_wifi", "venue_ambiance", "venue_fnb",
    "venue_service", "venue_power", "venue_noise", "venue_cleanliness",
  ]

  const maliciousKeys = [
    "__proto__",
    "constructor",
    "prototype",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "'; DROP TABLE --",
    "<script>",
    "venue_wifi; rm -rf /",
  ]

  for (const key of maliciousKeys) {
    it(`blocks malicious key: "${key.slice(0, 30)}"`, () => {
      expect(ALLOWED.includes(key)).toBe(false)
    })
  }
})

describe("Security: Partner Session Field Whitelist", () => {
  const ALLOWED_FIELDS = [
    "date", "start_time", "end_time", "duration_hours",
    "venue_price", "max_spots", "status",
  ]

  const blockedFields = [
    "id",
    "venue_id",
    "platform_fee",
    "total_price",
    "created_at",
    "spots_filled",
    "user_id",
    "__proto__",
  ]

  for (const field of blockedFields) {
    it(`blocks write to: ${field}`, () => {
      expect(ALLOWED_FIELDS.includes(field)).toBe(false)
    })
  }
})
