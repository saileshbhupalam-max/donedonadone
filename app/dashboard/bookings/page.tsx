"use client"

import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CalendarDays,
  Clock,
  MapPin,
  Ticket,
  Loader2,
  Users,
  Star,
  IndianRupee,
  RotateCcw,
  UsersRound,
  LogIn,
} from "lucide-react"
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

interface Booking {
  id: string
  session_id: string
  group_id: string | null
  status: string
  amount: number
  booked_at: string
  sessions: {
    id: string
    title: string
    session_date: string
    start_time: string
    end_time: string
    vibe: string
    current_participants: number
    max_participants: number
    venues: {
      name: string
      address: string
    } | null
  } | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function BookingsPage() {
  const { data, error, isLoading, mutate } = useSWR("/api/bookings", fetcher)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const bookings: Booking[] = data?.bookings || []
  const today = new Date().toISOString().split("T")[0]

  const upcoming = bookings.filter(
    (b) =>
      b.sessions &&
      b.sessions.session_date >= today &&
      b.status !== "cancelled" &&
      b.status !== "refunded"
  )
  const past = bookings.filter(
    (b) =>
      b.sessions &&
      b.sessions.session_date < today &&
      b.status !== "cancelled" &&
      b.status !== "refunded"
  )
  const cancelled = bookings.filter(
    (b) => b.status === "cancelled" || b.status === "refunded"
  )

  const handleCancel = async (bookingId: string) => {
    setCancelling(bookingId)
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      })
      if (res.ok) mutate()
    } finally {
      setCancelling(null)
    }
  }

  const Skeleton = () => (
    <div className="flex flex-col gap-3">
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
  )

  const EmptyState = ({
    icon: Icon,
    title,
    desc,
  }: {
    icon: React.ElementType
    title: string
    desc: string
  }) => (
    <Card className="border-border">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <Icon className="h-12 w-12 text-muted-foreground/30" />
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/sessions">Browse sessions</Link>
        </Button>
      </CardContent>
    </Card>
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">My Bookings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage your coworking session bookings
        </p>
      </div>

      {isLoading ? (
        <Skeleton />
      ) : error ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <p className="text-sm text-destructive">
              Failed to load bookings. Please try again.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">
              Upcoming{upcoming.length > 0 ? ` (${upcoming.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="past">
              Past{past.length > 0 ? ` (${past.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelled{cancelled.length > 0 ? ` (${cancelled.length})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* ---- Upcoming ---- */}
          <TabsContent value="upcoming" className="mt-4">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={Ticket}
                title="No upcoming bookings"
                desc="Browse sessions and book your next coworking experience"
              />
            ) : (
              <div className="flex flex-col gap-3">
                {upcoming.map((b) => (
                  <Card
                    key={b.id}
                    className="border-border transition-shadow hover:shadow-sm"
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">
                              {b.sessions?.title || "Session"}
                            </h3>
                            <Badge
                              className={statusColors[b.status]}
                              variant="secondary"
                            >
                              {statusLabels[b.status]}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            {b.sessions?.venues && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {b.sessions.venues.name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {new Date(
                                b.sessions!.session_date
                              ).toLocaleDateString("en-IN", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {b.sessions!.start_time?.slice(0, 5)} -{" "}
                              {b.sessions!.end_time?.slice(0, 5)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {b.sessions!.current_participants}/
                              {b.sessions!.max_participants} confirmed
                            </span>
                            <span className="flex items-center gap-1">
                              <IndianRupee className="h-3.5 w-3.5" />
                              {Number(b.amount || 0).toFixed(0)}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                          {/* Session-day contextual links */}
                          {b.group_id && b.sessions?.session_date === today && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/session/${b.session_id}/group`}>
                                <UsersRound className="mr-1 h-3 w-3" />
                                View Group
                              </Link>
                            </Button>
                          )}
                          {b.sessions?.session_date === today && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/session/${b.session_id}/checkin`}>
                                <LogIn className="mr-1 h-3 w-3" />
                                Check In
                              </Link>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancel(b.id)}
                            disabled={cancelling === b.id}
                            className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                          >
                            {cancelling === b.id && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---- Past ---- */}
          <TabsContent value="past" className="mt-4">
            {past.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No past sessions"
                desc="Your completed sessions will appear here"
              />
            ) : (
              <div className="flex flex-col gap-3">
                {past.map((b) => (
                  <Card key={b.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex flex-col gap-2">
                          <h3 className="font-semibold text-foreground">
                            {b.sessions?.title || "Session"}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            {b.sessions?.venues && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {b.sessions.venues.name}
                              </span>
                            )}
                            <span>
                              {new Date(
                                b.sessions!.session_date
                              ).toLocaleDateString("en-IN", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {b.sessions!.current_participants} coworkers
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          asChild
                        >
                          <Link href={`/session/${b.session_id}/feedback`}>
                            <Star className="mr-1 h-3.5 w-3.5" />
                            Rate Session
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---- Cancelled ---- */}
          <TabsContent value="cancelled" className="mt-4">
            {cancelled.length === 0 ? (
              <Card className="border-border">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <RotateCcw className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    No cancelled bookings
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {cancelled.map((b) => (
                  <Card key={b.id} className="border-border opacity-70">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">
                              {b.sessions?.title || "Session"}
                            </h3>
                            <Badge variant="secondary" className="bg-stone-200 text-stone-600">
                              {b.status === "refunded" ? "Refunded" : "Cancelled"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            {b.sessions?.venues && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {b.sessions.venues.name}
                              </span>
                            )}
                            {b.sessions && (
                              <span>
                                {new Date(
                                  b.sessions.session_date
                                ).toLocaleDateString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {b.status === "refunded"
                            ? `\u20B9${Number(b.amount || 0).toFixed(0)} refunded`
                            : "No charge"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
