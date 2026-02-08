import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getPartnerVenue } from "@/lib/partner"

export async function GET(request: NextRequest) {
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

  const { searchParams } = request.nextUrl
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const sessionId = searchParams.get("session_id")
  const checkedIn = searchParams.get("checked_in")

  // Get venue session IDs
  let sessionQuery = supabase
    .from("sessions")
    .select("id")
    .eq("venue_id", venue.id)

  if (dateFrom) {
    sessionQuery = sessionQuery.gte("session_date", dateFrom)
  }
  if (dateTo) {
    sessionQuery = sessionQuery.lte("session_date", dateTo)
  }

  const { data: venueSessions } = await sessionQuery
  const venueSessionIds = (venueSessions || []).map((s) => s.id)

  if (venueSessionIds.length === 0) {
    return NextResponse.json({ bookings: [] })
  }

  let bookingQuery = supabase
    .from("bookings")
    .select("*, sessions(session_date, start_time, end_time), profiles!bookings_user_id_fkey(display_name)")
    .in("session_id", venueSessionIds)
    .order("created_at", { ascending: false })

  if (sessionId) {
    bookingQuery = bookingQuery.eq("session_id", sessionId)
  }

  if (checkedIn === "true") {
    bookingQuery = bookingQuery.eq("checked_in", true)
  } else if (checkedIn === "false") {
    bookingQuery = bookingQuery.eq("checked_in", false)
  }

  const { data: bookings, error } = await bookingQuery

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ bookings: bookings || [] })
}
