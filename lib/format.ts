// Shared formatting utilities for dates, times, and currency.

/** Format a date string (YYYY-MM-DD) for display. */
export function formatDate(date: string, style: "short" | "long" = "short"): string {
  const d = new Date(date)
  if (style === "long") {
    return d.toLocaleDateString("en-IN", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

/** Format a time string "HH:MM:SS" → "HH:MM". */
export function formatTime(time: string): string {
  return time?.slice(0, 5) ?? ""
}

/** Format a number as Indian Rupees: 250 → "₹250". */
export function formatCurrency(amount: number): string {
  return `₹${Math.round(amount)}`
}
