// Shared constants — pricing, vibes, statuses, amenities.
// Import these instead of hardcoding values across components.

// ── Pricing ────────────────────────────────────────────
export const PLATFORM_FEE_2HR = 100
export const PLATFORM_FEE_4HR = 150

export function platformFee(durationHours: number): number {
  return durationHours === 2 ? PLATFORM_FEE_2HR : PLATFORM_FEE_4HR
}

// ── Work Vibes ─────────────────────────────────────────
export const VIBE_CONFIG: Record<string, { label: string; className: string }> = {
  deep_focus: { label: "Deep Focus", className: "bg-teal-100 text-teal-800" },
  casual_social: { label: "Casual Social", className: "bg-amber-100 text-amber-800" },
  balanced: { label: "Balanced", className: "bg-stone-200 text-stone-700" },
}

// ── Booking Statuses ───────────────────────────────────
export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  payment_pending: { label: "Payment Pending", className: "bg-amber-100 text-amber-800" },
  paid: { label: "Paid", className: "bg-teal-100 text-teal-800" },
  confirmed: { label: "Confirmed", className: "bg-teal-100 text-teal-800" },
  cancelled: { label: "Cancelled", className: "bg-stone-200 text-stone-600" },
  refunded: { label: "Refunded", className: "bg-stone-200 text-stone-600" },
}

// ── Session Statuses ───────────────────────────────────
export const SESSION_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  upcoming: { label: "Upcoming", className: "bg-blue-100 text-blue-800" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-800" },
  completed: { label: "Completed", className: "bg-teal-100 text-teal-800" },
  cancelled: { label: "Cancelled", className: "bg-stone-200 text-stone-600" },
}

// ── Venue Statuses ─────────────────────────────────────
export const VENUE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  active: { label: "Active", className: "bg-teal-100 text-teal-800" },
  inactive: { label: "Inactive", className: "bg-stone-200 text-stone-600" },
}

// ── Amenities ──────────────────────────────────────────
import {
  Wifi,
  Plug,
  Coffee,
  DoorOpen,
  Monitor,
  Printer,
  Phone,
  VolumeX,
} from "lucide-react"
import type React from "react"

export const AMENITY_ICONS: Record<string, React.ElementType> = {
  wifi: Wifi,
  power_outlets: Plug,
  coffee: Coffee,
  meeting_rooms: DoorOpen,
  standing_desks: Monitor,
  printer: Printer,
  phone_booths: Phone,
  quiet_zone: VolumeX,
}

export const AMENITY_LABELS: Record<string, string> = {
  wifi: "Wi-Fi",
  power_outlets: "Outlets",
  coffee: "Coffee",
  meeting_rooms: "Meeting Rooms",
  standing_desks: "Standing Desks",
  printer: "Printer",
  phone_booths: "Phone Booths",
  quiet_zone: "Quiet Zone",
}

// ── Trait badges (for admin grouping UI) ───────────────
export const NOISE_CONFIG: Record<string, { label: string; className: string }> = {
  silent: { label: "Silent", className: "bg-blue-100 text-blue-800" },
  ambient: { label: "Ambient", className: "bg-violet-100 text-violet-800" },
  lively: { label: "Lively", className: "bg-orange-100 text-orange-800" },
}

export const COMM_STYLE_CONFIG: Record<string, { label: string; className: string }> = {
  minimal: { label: "Minimal", className: "bg-slate-100 text-slate-800" },
  moderate: { label: "Moderate", className: "bg-cyan-100 text-cyan-800" },
  chatty: { label: "Chatty", className: "bg-pink-100 text-pink-800" },
}
