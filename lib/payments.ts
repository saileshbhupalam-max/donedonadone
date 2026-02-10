// UPI QR Code Payment Integration
// Generates real QR codes server-side using the qrcode package
// Flow: book -> generate QR -> user pays -> clicks "I've paid" -> admin verifies

import QRCode from "qrcode"

// UPI VPA for receiving payments (configure via env)
const UPI_VPA = process.env.NEXT_PUBLIC_UPI_VPA || "donedonadone@upi"
const UPI_PAYEE_NAME = process.env.NEXT_PUBLIC_UPI_PAYEE_NAME || "donedonadone"

export interface UPIPaymentParams {
  amount: number
  bookingId: string
  transactionNote?: string
}

/**
 * Generate a UPI payment link
 */
export function generateUPILink(params: UPIPaymentParams): string {
  const { amount, bookingId, transactionNote } = params
  const note = transactionNote || `donedonadone booking ${bookingId.slice(0, 8)}`

  const upiUrl = new URL("upi://pay")
  upiUrl.searchParams.set("pa", UPI_VPA)
  upiUrl.searchParams.set("pn", UPI_PAYEE_NAME)
  upiUrl.searchParams.set("am", amount.toFixed(2))
  upiUrl.searchParams.set("cu", "INR")
  upiUrl.searchParams.set("tn", note)
  upiUrl.searchParams.set("tr", bookingId.slice(0, 20))

  return upiUrl.toString()
}

/**
 * Generate a QR code as a data URL from a UPI link
 */
export async function generateQRDataUrl(upiLink: string): Promise<string> {
  return QRCode.toDataURL(upiLink, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  })
}

/**
 * Format amount in Indian rupees
 */
export function formatPaymentAmount(amount: number): string {
  return `\u20B9${amount.toFixed(0)}`
}
