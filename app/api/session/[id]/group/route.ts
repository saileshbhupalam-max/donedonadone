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

  // Verify user has a confirmed booking for this session
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, group_id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .in("payment_status", ["paid", "confirmed"])
    .single()

  if (!booking) {
    return NextResponse.json({ error: "No confirmed booking found" }, { status: 403 })
  }

  if (!booking.group_id) {
    return NextResponse.json({ error: "Group not assigned yet" }, { status: 404 })
  }

  // Get group details with members
  const { data: group } = await supabase
    .from("groups")
    .select("*, group_members(user_id, profiles(display_name, avatar_url, work_type), coworker_preferences(work_vibe, noise_preference, communication_style, bio, social_goals, introvert_extrovert))")
    .eq("id", booking.group_id)
    .single()

  // Get session + venue details
  const { data: session } = await supabase
    .from("sessions")
    .select("*, venues(name, address, area, lat, lng)")
    .eq("id", sessionId)
    .single()

  return NextResponse.json({ group, session })
}
