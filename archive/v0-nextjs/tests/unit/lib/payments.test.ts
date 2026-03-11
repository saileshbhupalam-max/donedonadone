import { describe, it, expect } from "vitest"
import { generateUPILink, generateQRDataUrl, formatPaymentAmount } from "@/lib/payments"

describe("generateUPILink", () => {
  const baseParams = {
    amount: 250,
    bookingId: "550e8400-e29b-41d4-a716-446655440000",
  }

  it("returns a upi:// URL", () => {
    const link = generateUPILink(baseParams)
    expect(link).toMatch(/^upi:\/\/pay/)
  })

  it("includes correct amount", () => {
    const link = generateUPILink(baseParams)
    expect(link).toContain("am=250.00")
  })

  it("includes INR currency", () => {
    const link = generateUPILink(baseParams)
    expect(link).toContain("cu=INR")
  })

  it("includes payee VPA", () => {
    const link = generateUPILink(baseParams)
    // Uses env var or default
    expect(link).toContain("pa=")
  })

  it("includes payee name", () => {
    const link = generateUPILink(baseParams)
    expect(link).toContain("pn=")
  })

  it("includes booking ID in transaction ref (truncated to 20)", () => {
    const link = generateUPILink(baseParams)
    expect(link).toContain("tr=550e8400-e29b-41d4-")
  })

  it("uses custom transaction note when provided", () => {
    const link = generateUPILink({ ...baseParams, transactionNote: "Custom note" })
    expect(link).toContain("tn=Custom+note")
  })

  it("generates default note with booking ID prefix", () => {
    const link = generateUPILink(baseParams)
    expect(link).toContain("tn=donedonadone+booking+550e8400")
  })
})

describe("generateQRDataUrl", () => {
  it("returns a data:image/png;base64 string", async () => {
    const result = await generateQRDataUrl("upi://pay?pa=test@upi&am=100")
    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it("generates different QR for different inputs", async () => {
    const qr1 = await generateQRDataUrl("upi://pay?am=100")
    const qr2 = await generateQRDataUrl("upi://pay?am=200")
    expect(qr1).not.toBe(qr2)
  })

  it("throws on empty string input", async () => {
    await expect(generateQRDataUrl("")).rejects.toThrow()
  })
})

describe("formatPaymentAmount", () => {
  it("formats with ₹ symbol", () => {
    expect(formatPaymentAmount(250)).toBe("₹250")
  })

  it("rounds to integer", () => {
    expect(formatPaymentAmount(199.7)).toBe("₹200")
  })

  it("handles zero", () => {
    expect(formatPaymentAmount(0)).toBe("₹0")
  })
})
