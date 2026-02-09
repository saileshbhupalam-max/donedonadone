import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get current month boundaries
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]

  // Sessions attended this month
  const { data: monthBookings } = await supabase
    .from("bookings")
    .select("id, session_id, checked_in, sessions(date, duration_hours, venue_id, venues(name))")
    .eq("user_id", user.id)
    .eq("checked_in", true)
    .gte("created_at", monthStart)

  const bookings = monthBookings || []
  const sessionsAttended = bookings.length
  const hoursFocused = bookings.reduce((sum, b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return sum + ((b.sessions as any)?.duration_hours || 0)
  }, 0)

  // Unique venues visited
  const venueNames = new Set<string>()
  bookings.forEach((b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vName = (b.sessions as any)?.venues?.name
    if (vName) venueNames.add(vName)
  })

  // People met
  const sessionIds = bookings.map((b) => b.session_id)
  let peopleMet = 0
  if (sessionIds.length > 0) {
    const { count } = await supabase
      .from("group_members")
      .select("user_id", { count: "exact", head: true })
      .in("group_id", bookings.map((b) => b.id).filter(Boolean))
      .neq("user_id", user.id)

    peopleMet = count || 0
  }

  // Streak
  const { data: streak } = await supabase
    .from("user_streaks")
    .select("current_streak, longest_streak")
    .eq("user_id", user.id)
    .single()

  // Goals completed
  const { data: goalsData } = await supabase
    .from("session_goals")
    .select("id, completed")
    .eq("user_id", user.id)
    .in("session_id", sessionIds.length > 0 ? sessionIds : ["none"])

  const totalGoals = goalsData?.length || 0
  const completedGoals = goalsData?.filter((g) => g.completed).length || 0

  // Top rated coworkers (people the user rated highly)
  const { data: topRated } = await supabase
    .from("member_ratings")
    .select("to_user, would_cowork_again, profiles:to_user(display_name)")
    .eq("from_user", user.id)
    .eq("would_cowork_again", true)
    .order("created_at", { ascending: false })
    .limit(5)

  return NextResponse.json({
    month: now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    sessionsAttended,
    hoursFocused,
    venuesVisited: venueNames.size,
    venueNames: Array.from(venueNames),
    peopleMet,
    currentStreak: streak?.current_streak || 0,
    longestStreak: streak?.longest_streak || 0,
    totalGoals,
    completedGoals,
    goalCompletionRate: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0,
    topCoworkers: (topRated || []).map((r) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: (r as any).profiles?.display_name || "Unknown",
    })),
  })
}
