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
  const weekStart = searchParams.get("week_start")

  let query = supabase
    .from("sessions")
    .select("*")
    .eq("venue_id", venue.id)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true })

  if (weekStart) {
    const weekEnd = new Date(
      new Date(weekStart).getTime() + 7 * 86400000
    )
      .toISOString()
      .split("T")[0]
    query = query.gte("session_date", weekStart).lt("session_date", weekEnd)
  }

  const { data: sessions, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sessions: sessions || [] })
}

export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const { session_date, start_time, duration_hours, max_spots, venue_price } =
    body

  if (!session_date || !start_time || !duration_hours) {
    return NextResponse.json(
      { error: "session_date, start_time, and duration_hours are required" },
      { status: 400 }
    )
  }

  // Calculate end time
  const [hours, minutes] = start_time.split(":").map(Number)
  const endHours = hours + duration_hours
  const end_time = `${String(endHours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}`

  // Platform fee from shared config
  const { platformFee: calcFee } = await import("@/lib/config")
  const platform_fee = calcFee(duration_hours)

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      venue_id: venue.id,
      date: session_date,
      start_time,
      end_time,
      duration_hours,
      platform_fee,
      venue_price: venue_price || 0,
      max_spots: max_spots || 20,
      status: "upcoming",
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session }, { status: 201 })
}
