import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: sessionId } = await params

  // Get user's booking
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, checked_in, checked_in_at, group_id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .in("payment_status", ["paid", "confirmed"])
    .single()

  if (!booking) {
    return NextResponse.json({ error: "No confirmed booking found" }, { status: 403 })
  }

  // Get group members' check-in status
  let members: Record<string, unknown>[] = []
  if (booking.group_id) {
    const { data: groupMembers } = await supabase
      .from("group_members")
      .select("user_id, profiles(display_name, avatar_url)")
      .eq("group_id", booking.group_id)

    // Get bookings for those members to see check-in status
    const memberIds = (groupMembers || []).map((m) => m.user_id)
    const { data: memberBookings } = await supabase
      .from("bookings")
      .select("user_id, checked_in")
      .eq("session_id", sessionId)
      .in("user_id", memberIds)

    const checkInMap = new Map(
      (memberBookings || []).map((b) => [b.user_id, b.checked_in])
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    members = (groupMembers || []).map((m: any) => ({
      user_id: m.user_id,
      display_name: m.profiles?.display_name || "Unknown",
      avatar_url: m.profiles?.avatar_url || null,
      checked_in: checkInMap.get(m.user_id) || false,
    }))
  }

  // Get session info
  const { data: session } = await supabase
    .from("sessions")
    .select("date, start_time, end_time, venues(name)")
    .eq("id", sessionId)
    .single()

  return NextResponse.json({
    booking: {
      id: booking.id,
      checked_in: booking.checked_in,
      checked_in_at: booking.checked_in_at,
    },
    members,
    session,
  })
}

// Maximum distance (meters) from venue to allow check-in
const MAX_CHECKIN_DISTANCE_M = 500

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371e3 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: sessionId } = await params

  // Get booking
  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .in("payment_status", ["paid", "confirmed"])
    .single()

  if (!booking) {
    return NextResponse.json({ error: "No confirmed booking found" }, { status: 403 })
  }

  // Geolocation verification (optional — if user sends coordinates)
  let body: { lat?: number; lng?: number } = {}
  try {
    body = await request.json()
  } catch {
    // No body or invalid JSON — allow check-in without geo (fallback)
  }

  if (body.lat != null && body.lng != null) {
    // Get venue coordinates
    const { data: session } = await supabase
      .from("sessions")
      .select("venues(lat, lng)")
      .eq("id", sessionId)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const venue = (session as any)?.venues
    if (venue?.lat && venue?.lng) {
      const distance = haversineDistance(body.lat, body.lng, venue.lat, venue.lng)
      if (distance > MAX_CHECKIN_DISTANCE_M) {
        return NextResponse.json({
          error: `You appear to be ${Math.round(distance)}m from the venue. Please check in from within ${MAX_CHECKIN_DISTANCE_M}m.`,
        }, { status: 400 })
      }
    }
  }

  // Call check_in RPC
  const { data, error } = await supabase.rpc("check_in_user", {
    p_booking_id: booking.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (data?.error) {
    return NextResponse.json({ error: data.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, checked_in_at: data?.checked_in_at })
}
