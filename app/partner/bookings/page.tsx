"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  CalendarDays,
  Clock,
  User,
  Check,
  X,
  Loader2,
  Filter,
} from "lucide-react"

interface Booking {
  id: string
  session_id: string
  payment_amount: number
  payment_status: string
  checked_in: boolean
  created_at: string
  sessions?: {
    session_date: string
    start_time: string
    end_time: string
  }
  profiles?: {
    display_name: string
  }
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [checkedInFilter, setCheckedInFilter] = useState<string>("")

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateFrom) params.set("date_from", dateFrom)
    if (dateTo) params.set("date_to", dateTo)
    if (checkedInFilter) params.set("checked_in", checkedInFilter)

    const res = await fetch(`/api/partner/bookings?${params.toString()}`)
    const data = await res.json()
    setBookings(data.bookings || [])
    setLoading(false)
  }, [dateFrom, dateTo, checkedInFilter])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Bookings</h2>
          <p className="text-sm text-muted-foreground">
            View coworker bookings at your venue
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="mr-1 h-3.5 w-3.5" /> Filters
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="border-border">
          <CardContent className="flex flex-wrap items-end gap-4 p-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-40 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 w-40 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Check-in</Label>
              <select
                value={checkedInFilter}
                onChange={(e) => setCheckedInFilter(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="">All</option>
                <option value="true">Checked in</option>
                <option value="false">Not checked in</option>
              </select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom("")
                setDateTo("")
                setCheckedInFilter("")
              }}
              className="text-xs"
            >
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bookings list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="py-20 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-2 text-sm text-muted-foreground">
            No bookings found
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((booking) => (
            <Card key={booking.id} className="border-border">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {booking.profiles?.display_name || "Unknown"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {booking.sessions && (
                      <>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(
                            booking.sessions.session_date
                          ).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {booking.sessions.start_time?.slice(0, 5)} –{" "}
                          {booking.sessions.end_time?.slice(0, 5)}
                        </span>
                      </>
                    )}
                    <span>{"\u20B9"}{booking.payment_amount}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        booking.payment_status === "paid" ||
                        booking.payment_status === "confirmed"
                          ? "bg-green-100 text-green-700"
                          : booking.payment_status === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {booking.payment_status}
                    </span>
                  </div>
                </div>

                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    booking.checked_in
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                  title={
                    booking.checked_in ? "Checked in" : "Not checked in"
                  }
                >
                  {booking.checked_in ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
