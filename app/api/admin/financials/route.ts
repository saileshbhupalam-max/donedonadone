import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/admin"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await verifyAdmin(supabase, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // All paid/confirmed bookings with session details
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, payment_amount, payment_status, created_at, sessions(platform_fee, venue_price, date, venues(name))")
    .in("payment_status", ["paid", "confirmed"])
    .order("created_at", { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = bookings || []

  const totalRevenue = rows.reduce((s: number, b: any) => s + (b.payment_amount || 0), 0)
  const totalPlatformFees = rows.reduce((s: number, b: any) => s + (b.sessions?.platform_fee || 0), 0)
  const totalVenuePayouts = rows.reduce((s: number, b: any) => s + (b.sessions?.venue_price || 0), 0)

  // Refunded bookings
  const { data: refunded } = await supabase
    .from("bookings")
    .select("payment_amount")
    .eq("payment_status", "refunded")

  const totalRefunds = (refunded || []).reduce((s, b) => s + (b.payment_amount || 0), 0)

  return NextResponse.json({
    kpis: {
      totalRevenue,
      totalPlatformFees,
      totalVenuePayouts,
      totalRefunds,
    },
    transactions: rows.slice(0, 50).map((b) => ({
      id: b.id,
      amount: b.payment_amount,
      platformFee: b.sessions?.platform_fee || 0,
      venuePrice: b.sessions?.venue_price || 0,
      date: b.created_at,
      sessionDate: b.sessions?.date,
      venueName: b.sessions?.venues?.name || "Unknown",
      status: b.payment_status,
    })),
  })
}
