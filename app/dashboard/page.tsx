import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  ArrowRight,
  Ticket,
  Hourglass,
  CalendarCheck,
  Star,
  Flame,
  TrendingUp,
  Crown,
} from "lucide-react"
import Link from "next/link"

import { VIBE_CONFIG, getTrustTier, getNextTier } from "@/lib/config"

function timeDiffHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  return Math.max((eh * 60 + em - (sh * 60 + sm)) / 60, 0)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userId = user?.id || ""
  const today = new Date().toISOString().split("T")[0]
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .split("T")[0]

  // ---- Data fetches ----
  // All user bookings (not cancelled)
  const { data: allBookings } = await supabase
    .from("bookings")
    .select("*, sessions(*, venues(*))")
    .eq("user_id", userId)
    .neq("payment_status", "cancelled")
    .order("created_at", { ascending: false })

  const bookings = allBookings || []

  // Split into past + upcoming
  const pastBookings = bookings.filter(
    (b) => b.sessions && b.sessions.date < today
  )
  const upcomingBookings = bookings.filter(
    (b) => b.sessions && b.sessions.date >= today
  )

  // This month bookings
  const thisMonthCount = pastBookings.filter(
    (b) => b.sessions && b.sessions.date >= monthStart
  ).length

  // Get real stats from get_user_stats RPC
  let stats = {
    sessions_completed: pastBookings.length,
    unique_coworkers: 0,
    venues_visited: 0,
    avg_rating_received: 0,
    hours_focused: 0,
    member_since: user?.created_at || "",
  }

  const { data: statsData } = await supabase.rpc("get_user_stats", {
    p_user_id: userId,
  })
  if (statsData) {
    stats = statsData
  }

  // Fallback hours if RPC not available
  if (!stats.hours_focused) {
    stats.hours_focused = pastBookings.reduce((sum, b) => {
      if (!b.sessions) return sum
      return sum + timeDiffHours(b.sessions.start_time, b.sessions.end_time)
    }, 0)
  }

  // Streak data
  const { data: streakData } = await supabase
    .from("user_streaks")
    .select("current_streak, longest_streak")
    .eq("user_id", userId)
    .single()

  const currentStreak = streakData?.current_streak || 0

  // Subscription status
  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select("*, subscription_plans(name, sessions_per_month)")
    .eq("user_id", userId)
    .eq("status", "active")
    .single()

  // Trust tier
  const tier = getTrustTier(stats.sessions_completed)
  const nextTier = getNextTier(stats.sessions_completed)

  // Next session
  const nextBooking = upcomingBookings.length > 0 ? upcomingBookings[upcomingBookings.length - 1] : null

  // Recent sessions (past, last 3)
  const recentBookings = pastBookings.slice(0, 3)

  // Recommended sessions (upcoming, not already booked)
  const bookedSessionIds = bookings.map((b) => b.session_id)
  const { data: recommended } = await supabase
    .from("sessions")
    .select("*, venues(*)")
    .eq("status", "upcoming")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(10)

  const recommendedSessions = (recommended || [])
    .filter((s) => !bookedSessionIds.includes(s.id))
    .slice(0, 3)

  // Favorites
  const { data: favorites } = await supabase
    .from("favorite_coworkers")
    .select("favorite_user_id, profiles:favorite_user_id(display_name, avatar_url)")
    .eq("user_id", userId)
    .limit(5)

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Streak + Tier Banner ---- */}
      <div className="flex flex-wrap items-center gap-3">
        {currentStreak > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold text-orange-700">{currentStreak}-week streak</span>
          </div>
        )}
        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${tier.className}`}>
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-semibold">{tier.label}</span>
        </div>
        {subscription && (
          <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5">
            <Crown className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-semibold text-violet-700">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(subscription as any).subscription_plans?.name} Plan
            </span>
          </div>
        )}
      </div>

      {/* ---- Quick Stats ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <CalendarCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.sessions_completed}</p>
              <p className="text-xs text-muted-foreground">Sessions attended</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
              <Users className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.unique_coworkers}</p>
              <p className="text-xs text-muted-foreground">People met</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <Hourglass className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{Math.round(stats.hours_focused)}</p>
              <p className="text-xs text-muted-foreground">Hours focused</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100">
              <Ticket className="h-5 w-5 text-teal-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{thisMonthCount}</p>
              <p className="text-xs text-muted-foreground">This month</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- Trust Tier Progress ---- */}
      {nextTier && (
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{stats.sessions_completed}</span> sessions
              </span>
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{nextTier.min}</span> for {nextTier.label}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min((stats.sessions_completed / nextTier.min) * 100, 100)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Subscription Status ---- */}
      {subscription && (
        <Card className="border-border">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(subscription as any).subscription_plans?.name} Plan
              </p>
              <p className="text-xs text-muted-foreground">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(subscription as any).subscription_plans?.sessions_per_month
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ? `${subscription.sessions_used}/${(subscription as any).subscription_plans.sessions_per_month} sessions used`
                  : `${subscription.sessions_used} sessions used (unlimited)`}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/pricing">Manage</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ---- Next Session ---- */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Next Session
        </h2>
        {nextBooking && nextBooking.sessions ? (
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-secondary to-teal-700 text-secondary-foreground">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold">
                  Coworking Session
                </h3>
                <div className="flex flex-col gap-1 text-sm text-teal-100">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {nextBooking.sessions.venues?.name || "Venue TBA"}
                  </span>
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(
                      nextBooking.sessions.date
                    ).toLocaleDateString("en-IN", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {nextBooking.sessions.start_time?.slice(0, 5)} -{" "}
                    {nextBooking.sessions.end_time?.slice(0, 5)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-teal-200">
                  {nextBooking.sessions.spots_filled}/{nextBooking.sessions.max_spots} coworkers confirmed
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 text-white hover:bg-white/30"
                  asChild
                >
                  <Link href="/dashboard/bookings">View Details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/30" />
              <div>
                <p className="font-medium text-foreground">No upcoming sessions</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browse available sessions and book your next coworking experience
                </p>
              </div>
              <Button asChild>
                <Link href="/dashboard/sessions">Browse Sessions</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ---- Favorites ---- */}
      {favorites && favorites.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Your Favorites
          </h2>
          <div className="flex flex-wrap gap-2">
            {favorites.map((f: Record<string, unknown>) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const prof = (f as any).profiles
              return (
                <div
                  key={f.favorite_user_id as string}
                  className="flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-200 text-xs font-semibold text-pink-700">
                    {prof?.display_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <span className="text-sm text-pink-700">{prof?.display_name || "Unknown"}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ---- Recent Sessions ---- */}
      {recentBookings.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Recent Sessions
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/bookings">
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {recentBookings.map((b) => (
              <Card key={b.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex flex-col gap-0.5">
                    <p className="font-medium text-foreground">
                      Coworking Session
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {b.sessions?.venues?.name}
                      </span>
                      <span>
                        {new Date(b.sessions?.date).toLocaleDateString(
                          "en-IN",
                          { month: "short", day: "numeric" }
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {b.sessions?.spots_filled} coworkers
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/session/${b.session_id}/feedback`}>
                      <Star className="mr-1 h-3 w-3" /> Rate
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ---- Recommended Sessions ---- */}
      {recommendedSessions.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Recommended for you
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/sessions">
                See all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedSessions.map((session) => (
              <Card
                key={session.id}
                className="border-border transition-shadow hover:shadow-md"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm text-foreground">
                      Coworking Session
                    </CardTitle>
                    {session.venues?.name && (
                      <Badge variant="secondary" className="text-xs">
                        {session.venues.name}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {session.venues?.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(session.date).toLocaleDateString(
                        "en-IN",
                        { weekday: "short", month: "short", day: "numeric" }
                      )}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-base font-bold text-foreground">
                      {"\u20B9"}{session.total_price}
                    </span>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/dashboard/sessions">Book</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ---- Monthly Wrapped Link ---- */}
      <Card className="border-border">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Monthly Summary</p>
            <p className="text-xs text-muted-foreground">See your coworking wrapped for this month</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/wrapped">View</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
