import { createClient } from "@/lib/supabase/server"
import { getPartnerVenue } from "@/lib/partner"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const venue = await getPartnerVenue(supabase, user.id)
  if (!venue) return NextResponse.json({ error: "No venue found" }, { status: 404 })

  // Get all sessions for this venue
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, date, start_time, end_time, max_spots, spots_filled, status")
    .eq("venue_id", venue.id)
    .order("date", { ascending: false })

  const allSessions = sessions || []
  const sessionIds = allSessions.map((s) => s.id)

  // Fill rate over time (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
  const recentSessions = allSessions.filter((s) => s.date >= thirtyDaysAgo)
  const fillRateTrend = recentSessions.map((s) => ({
    date: s.date,
    fill_rate: s.max_spots > 0 ? Math.round((s.spots_filled / s.max_spots) * 100) : 0,
  }))

  // Peak hours heatmap (count bookings by hour of day and day of week)
  const peakHours: Record<string, number> = {}
  for (const s of allSessions) {
    const hour = parseInt(s.start_time?.split(":")[0] || "0")
    const dayOfWeek = new Date(s.date).getDay()
    const key = `${dayOfWeek}-${hour}`
    peakHours[key] = (peakHours[key] || 0) + s.spots_filled
  }

  // Coworker demographics (work types of people who book at this venue)
  let demographics: Record<string, number> = {}
  if (sessionIds.length > 0) {
    const { data: bookingProfiles } = await supabase
      .from("bookings")
      .select("profiles(work_type)")
      .in("session_id", sessionIds)
      .neq("payment_status", "cancelled")

    for (const bp of bookingProfiles || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wt = (bp as any).profiles?.work_type || "unknown"
      demographics[wt] = (demographics[wt] || 0) + 1
    }
  }

  // Venue quality score
  let venueScore = null
  const { data: scoreData } = await supabase.rpc("compute_venue_score", {
    p_venue_id: venue.id,
  })
  if (scoreData) venueScore = scoreData

  return NextResponse.json({
    fillRateTrend,
    peakHours,
    demographics,
    venueScore,
    totalSessions: allSessions.length,
    completedSessions: allSessions.filter((s) => s.status === "completed").length,
    avgFillRate: recentSessions.length > 0
      ? Math.round(
          recentSessions.reduce((sum, s) => sum + (s.max_spots > 0 ? s.spots_filled / s.max_spots : 0), 0) /
          recentSessions.length * 100
        )
      : 0,
  })
}
