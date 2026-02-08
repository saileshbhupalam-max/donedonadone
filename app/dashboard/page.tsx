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
} from "lucide-react"
import Link from "next/link"

const vibeColors: Record<string, string> = {
  deep_focus: "bg-teal-100 text-teal-800",
  casual_social: "bg-amber-100 text-amber-800",
  balanced: "bg-stone-200 text-stone-700",
}
const vibeLabels: Record<string, string> = {
  deep_focus: "Deep Focus",
  casual_social: "Casual Social",
  balanced: "Balanced",
}

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
    .neq("status", "cancelled")
    .order("booked_at", { ascending: false })

  const bookings = allBookings || []

  // Split into past + upcoming
  const pastBookings = bookings.filter(
    (b) => b.sessions && b.sessions.session_date < today
  )
  const upcomingBookings = bookings.filter(
    (b) => b.sessions && b.sessions.session_date >= today
  )

  // This month bookings
  const thisMonthCount = pastBookings.filter(
    (b) => b.sessions && b.sessions.session_date >= monthStart
  ).length

  // Hours focused
  const hoursFocused = pastBookings.reduce((sum, b) => {
    if (!b.sessions) return sum
    return sum + timeDiffHours(b.sessions.start_time, b.sessions.end_time)
  }, 0)

  // People met (estimate: avg 4 per session minus self)
  const peopleMet = pastBookings.length * 3

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
    .gte("session_date", today)
    .order("session_date", { ascending: true })
    .limit(10)

  const recommendedSessions = (recommended || [])
    .filter((s) => !bookedSessionIds.includes(s.id))
    .slice(0, 3)

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Quick Stats ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <CalendarCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pastBookings.length}</p>
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
              <p className="text-2xl font-bold text-foreground">{peopleMet}</p>
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
              <p className="text-2xl font-bold text-foreground">{Math.round(hoursFocused)}</p>
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
                  {nextBooking.sessions.title}
                </h3>
                <div className="flex flex-col gap-1 text-sm text-teal-100">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {nextBooking.sessions.venues?.name || "Venue TBA"}
                  </span>
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(
                      nextBooking.sessions.session_date
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
                  {nextBooking.sessions.current_participants}/{nextBooking.sessions.max_participants} coworkers confirmed
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 text-white hover:bg-white/30"
                  asChild
                >
                  <Link href="/dashboard/sessions">View Details</Link>
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
                      {b.sessions?.title || "Session"}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {b.sessions?.venues?.name}
                      </span>
                      <span>
                        {new Date(b.sessions?.session_date).toLocaleDateString(
                          "en-IN",
                          { month: "short", day: "numeric" }
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {b.sessions?.current_participants} coworkers
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    <Star className="mr-1 h-3 w-3" /> Rate
                  </Badge>
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
                      {session.title}
                    </CardTitle>
                    <Badge
                      className={vibeColors[session.vibe] || vibeColors.balanced}
                      variant="secondary"
                    >
                      {vibeLabels[session.vibe] || session.vibe}
                    </Badge>
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
                      {new Date(session.session_date).toLocaleDateString(
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
                      {"\u20B9"}{Number(session.price).toFixed(0)}
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
    </div>
  )
}
