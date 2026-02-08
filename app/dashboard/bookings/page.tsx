"use client"

import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarDays, Clock, MapPin, Ticket, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  payment_pending: "bg-amber-100 text-amber-800",
  paid: "bg-teal-100 text-teal-800",
  confirmed: "bg-teal-100 text-teal-800",
  cancelled: "bg-stone-200 text-stone-600",
  refunded: "bg-stone-200 text-stone-600",
}

const statusLabels: Record<string, string> = {
  pending: "Pending",
  payment_pending: "Payment Pending",
  paid: "Paid",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  refunded: "Refunded",
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function BookingsPage() {
  const { data, error, isLoading, mutate } = useSWR("/api/bookings", fetcher)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const bookings = data?.bookings || []

  const handleCancel = async (bookingId: string) => {
    setCancelling(bookingId)
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      })

      if (res.ok) {
        mutate()
      }
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">My Bookings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage your coworking session bookings
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <p className="text-sm text-destructive">
              Failed to load bookings. Please try again.
            </p>
          </CardContent>
        </Card>
      ) : bookings.length > 0 ? (
        <div className="flex flex-col gap-4">
          {bookings.map(
            (booking: {
              id: string
              status: string
              amount: number
              booked_at: string
              sessions: {
                title: string
                session_date: string
                start_time: string
                end_time: string
                venues: {
                  name: string
                  address: string
                } | null
              } | null
            }) => {
              const session = booking.sessions
              const venue = session?.venues
              const canCancel =
                booking.status !== "cancelled" &&
                booking.status !== "refunded"

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
                            statusColors[booking.status] ||
                            statusColors.pending
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
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      <p className="text-lg font-bold text-foreground">
                        {"₹"}{Number(booking.amount || 0).toFixed(0)}
                      </p>
                      {canCancel && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(booking.id)}
                          disabled={cancelling === booking.id}
                          className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                        >
                          {cancelling === booking.id && (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          )}
                          Cancel
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            }
          )}
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
