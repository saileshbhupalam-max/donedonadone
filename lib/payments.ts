// UPI QR Code Payment Integration
// Uses upiqr package to generate UPI QR codes for MVP
// Flow: book -> generate QR -> user pays -> clicks "I've paid" -> admin verifies

// UPI VPA for receiving payments (configure via env)
const UPI_VPA = process.env.NEXT_PUBLIC_UPI_VPA || "donedonadone@upi"
const UPI_PAYEE_NAME = process.env.NEXT_PUBLIC_UPI_PAYEE_NAME || "donedonadone"

export interface UPIPaymentParams {
  amount: number
  bookingId: string
  transactionNote?: string
}

export interface UPIPaymentResult {
  qrDataUrl: string
  upiLink: string
  amount: number
  bookingId: string
}

/**
 * Generate a UPI payment link and QR code data
 * The QR code encodes a UPI deep link that opens any UPI app
 */
export function generateUPILink(params: UPIPaymentParams): string {
  const { amount, bookingId, transactionNote } = params
  const note = transactionNote || `donedonadone booking ${bookingId.slice(0, 8)}`

  // UPI deep link format
  const upiUrl = new URL("upi://pay")
  upiUrl.searchParams.set("pa", UPI_VPA)
  upiUrl.searchParams.set("pn", UPI_PAYEE_NAME)
  upiUrl.searchParams.set("am", amount.toFixed(2))
  upiUrl.searchParams.set("cu", "INR")
  upiUrl.searchParams.set("tn", note)
  upiUrl.searchParams.set("tr", bookingId.slice(0, 20)) // transaction ref

  return upiUrl.toString()
}

/**
 * Format amount in Indian rupees
 */
export function formatPaymentAmount(amount: number): string {
  return `\u20B9${amount.toFixed(0)}`
}
