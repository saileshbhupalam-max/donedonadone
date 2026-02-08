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

  const today = new Date().toISOString().split("T")[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .split("T")[0]

  // Get all sessions for this venue
  const { data: venueSessions } = await supabase
    .from("sessions")
    .select("id, session_date, start_time, end_time, status, current_participants, max_participants")
    .eq("venue_id", venue.id)

  const sessionIds = (venueSessions || []).map((s) => s.id)

  // Today's bookings
  const todaySessions = (venueSessions || []).filter(
    (s) => s.session_date === today
  )
  const todaySessionIds = todaySessions.map((s) => s.id)

  let todayBookings = 0
  if (todaySessionIds.length > 0) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("session_id", todaySessionIds)
      .neq("payment_status", "cancelled")

    todayBookings = count || 0
  }

  // This week bookings
  const weekSessionIds = (venueSessions || [])
    .filter((s) => s.session_date >= weekAgo)
    .map((s) => s.id)

  let weekBookings = 0
  let weekRevenue = 0
  if (weekSessionIds.length > 0) {
    const { data: weekBookingData } = await supabase
      .from("bookings")
      .select("id, payment_amount")
      .in("session_id", weekSessionIds)
      .neq("payment_status", "cancelled")

    weekBookings = (weekBookingData || []).length
    weekRevenue = (weekBookingData || []).reduce(
      (sum, b) => sum + (b.payment_amount || 0),
      0
    )
  }

  // This month bookings + revenue
  const monthSessionIds = (venueSessions || [])
    .filter((s) => s.session_date >= monthStart)
    .map((s) => s.id)

  let monthBookings = 0
  let monthRevenue = 0
  if (monthSessionIds.length > 0) {
    const { data: monthBookingData } = await supabase
      .from("bookings")
      .select("id, payment_amount")
      .in("session_id", monthSessionIds)
      .neq("payment_status", "cancelled")

    monthBookings = (monthBookingData || []).length
    monthRevenue = (monthBookingData || []).reduce(
      (sum, b) => sum + (b.payment_amount || 0),
      0
    )
  }

  // Average rating
  let avgRating = 0
  if (sessionIds.length > 0) {
    const { data: feedback } = await supabase
      .from("session_feedback")
      .select("overall_rating")
      .in("session_id", sessionIds)
      .not("overall_rating", "is", null)

    if (feedback && feedback.length > 0) {
      avgRating =
        feedback.reduce((sum, f) => sum + f.overall_rating, 0) /
        feedback.length
    }
  }

  // Today's sessions for timeline
  const todayTimeline = todaySessions.map((s) => ({
    id: s.id,
    start_time: s.start_time,
    end_time: s.end_time,
    status: s.status,
    current_participants: s.current_participants,
    max_participants: s.max_participants,
  }))

  // Recent reviews
  let recentReviews: { overall_rating: number; comment: string | null; created_at: string }[] = []
  if (sessionIds.length > 0) {
    const { data: reviews } = await supabase
      .from("session_feedback")
      .select("overall_rating, comment, created_at")
      .in("session_id", sessionIds)
      .not("comment", "is", null)
      .order("created_at", { ascending: false })
      .limit(5)

    recentReviews = reviews || []
  }

  return NextResponse.json({
    todayBookings,
    weekBookings,
    weekRevenue,
    monthBookings,
    monthRevenue,
    avgRating: Math.round(avgRating * 10) / 10,
    todayTimeline,
    recentReviews,
  })
}
