import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { moderateText } from "@/lib/moderation"
import { isValidUUID } from "@/lib/utils"

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

  // Verify booking (must be checked in)
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, group_id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .in("payment_status", ["paid", "confirmed"])
    .eq("checked_in", true)
    .single()

  if (!booking) {
    return NextResponse.json({ error: "No confirmed & checked-in booking found" }, { status: 403 })
  }

  // Check if feedback already submitted
  const { data: existing } = await supabase
    .from("session_feedback")
    .select("*")
    .eq("booking_id", booking.id)
    .single()

  // Get group members (for per-member ratings)
  let members: Record<string, unknown>[] = []
  if (booking.group_id) {
    const { data: groupMembers } = await supabase
      .from("group_members")
      .select("user_id, profiles(display_name, avatar_url)")
      .eq("group_id", booking.group_id)
      .neq("user_id", user.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    members = (groupMembers || []).map((m: any) => ({
      user_id: m.user_id,
      display_name: m.profiles?.display_name || "Unknown",
      avatar_url: m.profiles?.avatar_url || null,
    }))
  }

  // Get session info
  const { data: session } = await supabase
    .from("sessions")
    .select("date, start_time, end_time, venues(name)")
    .eq("id", sessionId)
    .single()

  // Get user's goals for this session
  const { data: goals } = await supabase
    .from("session_goals")
    .select("id, goal_text, completed")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)

  return NextResponse.json({
    booking: { id: booking.id },
    existing: existing || null,
    members,
    session,
    goals: goals || [],
  })
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

  // Verify booking (must be checked in)
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, group_id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .in("payment_status", ["paid", "confirmed"])
    .eq("checked_in", true)
    .single()

  if (!booking) {
    return NextResponse.json({ error: "No confirmed & checked-in booking found" }, { status: 403 })
  }

  // Enforce 7-day feedback window
  const { data: sessionData } = await supabase
    .from("sessions")
    .select("date")
    .eq("id", sessionId)
    .single()

  if (sessionData?.date) {
    const sessionDate = new Date(sessionData.date)
    const daysSince = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > 7) {
      return NextResponse.json({ error: "Feedback window has closed (7 days)" }, { status: 400 })
    }
  }

  const body = await request.json()
  const { overall_rating, tags, comment, venue_ratings, member_ratings, favorites, goal_completions } = body

  if (!overall_rating || overall_rating < 1 || overall_rating > 5) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 })
  }

  // Validate session ID format
  if (!isValidUUID(sessionId)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 })
  }

  // Moderate comment text
  if (comment) {
    const modResult = moderateText(comment)
    if (!modResult.clean) {
      return NextResponse.json({ error: modResult.reason }, { status: 400 })
    }
  }

  // Insert session feedback with venue ratings
  const feedbackRow: Record<string, unknown> = {
    booking_id: booking.id,
    user_id: user.id,
    session_id: sessionId,
    overall_rating,
    tags: tags || [],
    comment: comment || null,
  }

  // Add venue dimension ratings if provided (whitelist keys)
  const ALLOWED_VENUE_KEYS = [
    "venue_wifi", "venue_ambiance", "venue_fnb",
    "venue_service", "venue_power", "venue_noise", "venue_cleanliness",
  ]
  if (venue_ratings && typeof venue_ratings === "object") {
    for (const [key, value] of Object.entries(venue_ratings)) {
      if (ALLOWED_VENUE_KEYS.includes(key) && typeof value === "number" && value >= 1 && value <= 5) {
        feedbackRow[key] = value
      }
    }
  }

  const { error: fbError } = await supabase.from("session_feedback").insert(feedbackRow)

  if (fbError) return NextResponse.json({ error: fbError.message }, { status: 500 })

  // Insert member ratings (with enhanced fields) — filter self-ratings and validate group membership
  if (member_ratings && Array.isArray(member_ratings)) {
    // Get valid group members for this booking's group
    let validGroupUserIds: string[] = []
    if (booking.group_id) {
      const { data: groupMembers } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", booking.group_id)
      validGroupUserIds = (groupMembers || []).map((m: { user_id: string }) => m.user_id)
    }

    const ratings = member_ratings
      .filter((mr: { to_user: string }) =>
        mr.to_user !== user.id && validGroupUserIds.includes(mr.to_user)
      )
      .map((mr: {
        to_user: string
        would_cowork_again: boolean
        tags?: string[]
        energy_match?: number | null
      }) => ({
        from_user: user.id,
        to_user: mr.to_user,
        session_id: sessionId,
        would_cowork_again: mr.would_cowork_again,
        tags: mr.tags || [],
        energy_match: mr.energy_match || null,
      }))

    if (ratings.length > 0) {
      await supabase.from("member_ratings").insert(ratings)
    }
  }

  // Insert favorites
  if (favorites && Array.isArray(favorites) && favorites.length > 0) {
    const favRows = favorites.map((favoriteUserId: string) => ({
      user_id: user.id,
      favorite_user_id: favoriteUserId,
    }))

    // Upsert to handle duplicates gracefully
    await supabase.from("favorite_coworkers").upsert(favRows, {
      onConflict: "user_id,favorite_user_id",
    })
  }

  // Update goal completions
  if (goal_completions && Array.isArray(goal_completions)) {
    for (const gc of goal_completions) {
      await supabase
        .from("session_goals")
        .update({ completed: gc.completed })
        .eq("id", gc.goal_id)
        .eq("user_id", user.id)
    }
  }

  return NextResponse.json({ success: true })
}
