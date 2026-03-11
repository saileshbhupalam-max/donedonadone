import { describe, it, expect } from "vitest"
import { formatTime, formatCurrency } from "@/lib/format"

describe("formatTime", () => {
  it("formats HH:MM:SS to HH:MM", () => {
    expect(formatTime("14:30:00")).toBe("14:30")
  })

  it("handles HH:MM input (no seconds)", () => {
    expect(formatTime("09:00")).toBe("09:00")
  })

  it("returns empty for undefined/null", () => {
    // @ts-expect-error testing null input
    expect(formatTime(null)).toBe("")
    // @ts-expect-error testing undefined input
    expect(formatTime(undefined)).toBe("")
  })
})

describe("formatCurrency", () => {
  it("formats with ₹ symbol", () => {
    expect(formatCurrency(250)).toBe("₹250")
  })

  it("rounds to integer", () => {
    expect(formatCurrency(199.7)).toBe("₹200")
  })

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("₹0")
  })

  it("handles large amounts", () => {
    expect(formatCurrency(10000)).toBe("₹10000")
  })
})
