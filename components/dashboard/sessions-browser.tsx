"use client"

import { useState, useCallback } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Input } from "@/components/ui/input"
import { SessionCard } from "./session-card"
import { BookingSheet } from "./booking-sheet"
import { CalendarDays, Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const vibeFilters = [
  { value: "all", label: "All" },
  { value: "deep_focus", label: "Deep Focus" },
  { value: "casual_social", label: "Casual Social" },
  { value: "balanced", label: "Balanced" },
]

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function SessionsBrowser() {
  const [vibe, setVibe] = useState("all")
  const [search, setSearch] = useState("")
  const [date, setDate] = useState("")
  const [bookingSessionId, setBookingSessionId] = useState<string | null>(null)
  const [bookingLoading, setBookingLoading] = useState<string | null>(null)

  const params = new URLSearchParams()
  if (vibe !== "all") params.set("vibe", vibe)
  if (date) params.set("date", date)
  if (search) params.set("search", search)

  const {
    data,
    error,
    isLoading,
  } = useSWR(`/api/sessions?${params.toString()}`, fetcher, {
    revalidateOnFocus: false,
  })

  // Also fetch user's active bookings to check if already booked
  const { data: bookingsData } = useSWR("/api/bookings", fetcher, {
    revalidateOnFocus: false,
  })

  const bookedSessionIds = new Set(
    (bookingsData?.bookings || [])
      .filter((b: { status: string }) => b.status !== "cancelled")
      .map((b: { session_id: string }) => b.session_id)
  )

  const sessions = data?.sessions || []

  const handleBook = useCallback((sessionId: string) => {
    setBookingSessionId(sessionId)
  }, [])

  const handleConfirmBooking = useCallback(async () => {
    if (!bookingSessionId) return

    setBookingLoading(bookingSessionId)
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: bookingSessionId }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || "Booking failed")
      }

      // Revalidate data
      globalMutate(`/api/sessions?${params.toString()}`)
      globalMutate("/api/bookings")

      return result.booking
    } catch (err) {
      throw err
    } finally {
      setBookingLoading(null)
    }
  }, [bookingSessionId, params])

  const selectedSession = sessions.find(
    (s: { id: string }) => s.id === bookingSessionId
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Browse Sessions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Find and book coworking sessions at venues near you
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Vibe chips */}
        <div className="flex flex-wrap gap-2">
          {vibeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setVibe(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                vibe === f.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 items-center gap-2 sm:ml-auto sm:max-w-sm">
          {/* Date filter */}
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-[140px] rounded-md border border-input bg-background pl-8 pr-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search venues..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {/* Sessions grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-16 w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <p className="text-sm text-destructive">
              Failed to load sessions. Please try again.
            </p>
          </CardContent>
        </Card>
      ) : sessions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map(
            (session: {
              id: string
              title: string
              description: string
              session_date: string
              start_time: string
              end_time: string
              max_participants: number
              current_participants: number
              vibe: string
              price: number
              venues: {
                name: string
                address: string
                city: string
                amenities: string[]
                wifi_speed_mbps: number | null
                type: string
              } | null
            }) => (
              <SessionCard
                key={session.id}
                session={session}
                onBook={handleBook}
                isBooked={bookedSessionIds.has(session.id)}
                isLoading={bookingLoading === session.id}
              />
            )
          )}
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No sessions match your filters. Try adjusting your search.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Booking confirmation sheet */}
      {selectedSession && (
        <BookingSheet
          session={selectedSession}
          open={!!bookingSessionId}
          onClose={() => setBookingSessionId(null)}
          onConfirm={handleConfirmBooking}
        />
      )}
    </div>
  )
}
