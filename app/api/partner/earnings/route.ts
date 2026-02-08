import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getPartnerVenue } from "@/lib/partner"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const venue = await getPartnerVenue(supabase, user.id)
  if (!venue) {
    return NextResponse.json({ error: "No venue found" }, { status: 404 })
  }

  // Get all venue sessions
  const { data: venueSessions } = await supabase
    .from("sessions")
    .select("id, session_date, venue_price")
    .eq("venue_id", venue.id)

  const allSessions = venueSessions || []
  const sessionIds = allSessions.map((s) => s.id)

  if (sessionIds.length === 0) {
    return NextResponse.json({
      thisMonth: 0,
      lastMonth: 0,
      allTime: 0,
      dailyBreakdown: [],
    })
  }

  // Get all non-cancelled bookings for these sessions
  const { data: bookings } = await supabase
    .from("bookings")
    .select("session_id, payment_amount, created_at")
    .in("session_id", sessionIds)
    .neq("payment_status", "cancelled")

  const allBookings = bookings || []

  // Build session date lookup
  const sessionDateMap: Record<string, string> = {}
  const sessionVenuePriceMap: Record<string, number> = {}
  for (const s of allSessions) {
    sessionDateMap[s.id] = s.session_date
    sessionVenuePriceMap[s.id] = s.venue_price || 0
  }

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .split("T")[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    .toISOString()
    .split("T")[0]

  let thisMonth = 0
  let lastMonth = 0
  let allTime = 0

  for (const b of allBookings) {
    const sessionDate = sessionDateMap[b.session_id] || ""
    const amount = b.payment_amount || 0
    allTime += amount

    if (sessionDate >= thisMonthStart) {
      thisMonth += amount
    } else if (sessionDate >= lastMonthStart && sessionDate <= lastMonthEnd) {
      lastMonth += amount
    }
  }

  // Daily breakdown (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .split("T")[0]

  const dailyMap: Record<string, number> = {}

  // Initialize last 30 days
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - (29 - i) * 86400000)
      .toISOString()
      .split("T")[0]
    dailyMap[d] = 0
  }

  for (const b of allBookings) {
    const sessionDate = sessionDateMap[b.session_id] || ""
    if (sessionDate >= thirtyDaysAgo) {
      dailyMap[sessionDate] = (dailyMap[sessionDate] || 0) + (b.payment_amount || 0)
    }
  }

  const dailyBreakdown = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }))

  return NextResponse.json({
    thisMonth,
    lastMonth,
    allTime,
    dailyBreakdown,
  })
}
