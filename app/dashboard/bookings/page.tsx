import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Clock, MapPin, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  payment_pending: "bg-amber-100 text-amber-800",
  paid: "bg-teal-100 text-teal-800",
  confirmed: "bg-teal-100 text-teal-800",
  cancelled: "bg-stone-100 text-stone-800",
  refunded: "bg-stone-100 text-stone-800",
}

const statusLabels: Record<string, string> = {
  pending: "Pending",
  payment_pending: "Payment Pending",
  paid: "Paid",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  refunded: "Refunded",
}

export default async function BookingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, sessions(*, venues(*))")
    .eq("user_id", user?.id || "")
    .order("booked_at", { ascending: false })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">My Bookings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage your coworking session bookings
        </p>
      </div>

      {bookings && bookings.length > 0 ? (
        <div className="flex flex-col gap-4">
          {bookings.map((booking) => {
            const session = booking.sessions
            const venue = session?.venues
            return (
              <Card key={booking.id} className="border-border">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {session?.title || "Session"}
                      </h3>
                      <Badge
                        className={
                          statusColors[booking.status] || statusColors.pending
                        }
                        variant="secondary"
                      >
                        {statusLabels[booking.status] || booking.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      {venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {venue.name}
                        </span>
                      )}
                      {session && (
                        <>
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {new Date(
                              session.session_date
                            ).toLocaleDateString("en-IN", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {session.start_time?.slice(0, 5)} -{" "}
                            {session.end_time?.slice(0, 5)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">
                      {"₹"}{Number(booking.amount || 0).toFixed(0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Ticket className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="font-medium text-foreground">No bookings yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse sessions and book your first coworking experience
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/sessions">Browse sessions</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
