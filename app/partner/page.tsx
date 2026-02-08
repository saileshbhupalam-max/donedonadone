import { createClient } from "@/lib/supabase/server"
import { getPartnerVenue } from "@/lib/partner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Users,
  CalendarDays,
  IndianRupee,
  Star,
  Clock,
  ArrowRight,
  Plus,
} from "lucide-react"
import Link from "next/link"

export default async function PartnerDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const venue = await getPartnerVenue(supabase, user!.id)

  if (!venue) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <CalendarDays className="h-12 w-12 text-muted-foreground/30" />
        <h2 className="text-lg font-semibold text-foreground">
          No venue set up yet
        </h2>
        <p className="text-sm text-muted-foreground">
          Contact the admin to get your venue registered.
        </p>
      </div>
    )
  }

  const today = new Date().toISOString().split("T")[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .split("T")[0]
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .split("T")[0]

  // All venue sessions
  const { data: venueSessions } = await supabase
    .from("sessions")
    .select("id, session_date, start_time, end_time, status, current_participants, max_participants")
    .eq("venue_id", venue.id)

  const allSessions = venueSessions || []
  const sessionIds = allSessions.map((s) => s.id)

  // Today's sessions for timeline
  const todaySessions = allSessions
    .filter((s) => s.session_date === today)
    .sort((a, b) => (a.start_time > b.start_time ? 1 : -1))

  // Booking counts
  let todayBookings = 0
  let weekBookings = 0
  let monthRevenue = 0

  const todaySessionIds = todaySessions.map((s) => s.id)
  if (todaySessionIds.length > 0) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("session_id", todaySessionIds)
      .neq("payment_status", "cancelled")
    todayBookings = count || 0
  }

  const weekSessionIds = allSessions
    .filter((s) => s.session_date >= weekAgo)
    .map((s) => s.id)
  if (weekSessionIds.length > 0) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("session_id", weekSessionIds)
      .neq("payment_status", "cancelled")
    weekBookings = count || 0
  }

  const monthSessionIds = allSessions
    .filter((s) => s.session_date >= monthStart)
    .map((s) => s.id)
  if (monthSessionIds.length > 0) {
    const { data: monthBookingData } = await supabase
      .from("bookings")
      .select("payment_amount")
      .in("session_id", monthSessionIds)
      .neq("payment_status", "cancelled")
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

  // Recent reviews
  let recentReviews: {
    overall_rating: number
    comment: string | null
    created_at: string
  }[] = []
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

  return (
    <div className="flex flex-col gap-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {todayBookings}
              </p>
              <p className="text-xs text-muted-foreground">Today&apos;s bookings</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100">
              <CalendarDays className="h-5 w-5 text-teal-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {weekBookings}
              </p>
              <p className="text-xs text-muted-foreground">This week</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <IndianRupee className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {"\u20B9"}{monthRevenue}
              </p>
              <p className="text-xs text-muted-foreground">Month revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-100">
              <Star className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {avgRating > 0 ? avgRating.toFixed(1) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Avg rating</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Sessions Timeline */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Today&apos;s Sessions
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/partner/sessions">
              All sessions <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {todaySessions.length > 0 ? (
          <div className="flex flex-col gap-2">
            {todaySessions.map((session) => (
              <Card key={session.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {session.start_time?.slice(0, 5)} –{" "}
                        {session.end_time?.slice(0, 5)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.current_participants}/{session.max_participants}{" "}
                        booked
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      session.status === "in_progress"
                        ? "bg-green-100 text-green-800"
                        : session.status === "completed"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-teal-100 text-teal-800"
                    }`}
                  >
                    {session.status === "in_progress"
                      ? "Live"
                      : session.status === "completed"
                        ? "Done"
                        : "Upcoming"}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border">
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No sessions scheduled today
              </p>
              <Button size="sm" asChild>
                <Link href="/partner/sessions">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Create Session
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Reviews */}
      {recentReviews.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Recent Reviews
          </h2>
          <div className="flex flex-col gap-2">
            {recentReviews.map((review, i) => (
              <Card key={i} className="border-border">
                <CardContent className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star
                          key={idx}
                          className={`h-3.5 w-3.5 ${
                            idx < review.overall_rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{review.comment}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Button variant="outline" className="h-auto py-4" asChild>
          <Link
            href="/partner/sessions"
            className="flex flex-col items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs">New Session</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4" asChild>
          <Link
            href="/partner/bookings"
            className="flex flex-col items-center gap-2"
          >
            <Users className="h-5 w-5" />
            <span className="text-xs">View Bookings</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4" asChild>
          <Link
            href="/partner/earnings"
            className="flex flex-col items-center gap-2"
          >
            <IndianRupee className="h-5 w-5" />
            <span className="text-xs">Earnings</span>
          </Link>
        </Button>
      </div>
    </div>
  )
}
