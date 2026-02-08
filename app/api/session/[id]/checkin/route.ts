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

export async function POST(
  _request: NextRequest,
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
