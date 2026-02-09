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
    .select("id, group_id, checked_in")
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

  // Check if current user has checked in (for information asymmetry)
  const hasCheckedIn = booking.checked_in === true

  // Get group details with members — select different fields based on check-in status
  const { data: group } = await supabase
    .from("groups")
    .select("*, group_members(user_id, profiles(display_name, avatar_url, work_type, industry), coworker_preferences(work_vibe, noise_preference, communication_style, bio, social_goals, introvert_extrovert))")
    .eq("id", booking.group_id)
    .single()

  // Apply information asymmetry: limit profile data before check-in
  if (group?.group_members && !hasCheckedIn) {
    group.group_members = group.group_members.map((member: Record<string, unknown>) => {
      const profile = member.profiles as Record<string, unknown> | null
      const prefs = member.coworker_preferences as Record<string, unknown> | null
      // Before check-in: only show first name, work vibe, and avatar
      return {
        user_id: member.user_id,
        profiles: profile ? {
          display_name: (profile.display_name as string)?.split(" ")[0] || "Unknown",
          avatar_url: profile.avatar_url,
          work_type: null,
          industry: null,
        } : null,
        coworker_preferences: prefs ? {
          work_vibe: prefs.work_vibe,
          noise_preference: null,
          communication_style: null,
          bio: null,
          social_goals: [],
          introvert_extrovert: null,
        } : null,
      }
    })
  }

  // Get session + venue details
  const { data: session } = await supabase
    .from("sessions")
    .select("*, venues(name, address, area, lat, lng)")
    .eq("id", sessionId)
    .single()

  // Get session goals for this group's members
  const memberIds = group?.group_members?.map((m: Record<string, unknown>) => m.user_id as string) || []
  let goals: Record<string, unknown>[] = []
  if (memberIds.length > 0) {
    const { data: goalsData } = await supabase
      .from("session_goals")
      .select("id, user_id, goal_text, completed")
      .eq("session_id", sessionId)
      .in("user_id", memberIds)

    goals = goalsData || []
  }

  return NextResponse.json({ group, session, hasCheckedIn, goals })
}
