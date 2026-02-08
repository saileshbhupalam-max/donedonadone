"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, CalendarDays, Clock, MapPin, Users } from "lucide-react"
import { SESSION_STATUS_CONFIG } from "@/lib/config"
import { formatDate, formatTime } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminSessionsPage() {
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const params = new URLSearchParams()
  if (statusFilter !== "all") params.set("status", statusFilter)
  if (dateFrom) params.set("date_from", dateFrom)
  if (dateTo) params.set("date_to", dateTo)

  const { data, isLoading } = useSWR(`/api/admin/sessions?${params}`, fetcher)
  const sessions = data?.sessions || []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Sessions</h2>
        <p className="mt-1 text-sm text-muted-foreground">View all sessions across venues</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex gap-2">
          {["all", "upcoming", "in_progress", "completed", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {s === "all" ? "All" : SESSION_STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
        </div>
      </div>

      {/* Sessions list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No sessions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session: Record<string, unknown>) => {
            const statusConfig = SESSION_STATUS_CONFIG[session.status as string]
            return (
              <Card key={session.id as string} className="border-border">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">
                          {formatDate(session.date as string)}
                        </h3>
                        {statusConfig && (
                          <Badge className={statusConfig.className} variant="secondary">
                            {statusConfig.label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {(session.venues as Record<string, unknown>)?.name as string || "Unknown"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(session.start_time as string)} - {formatTime(session.end_time as string)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {session.spots_filled as number}/{session.max_spots as number} spots
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-foreground">₹{session.total_price as number}</p>
                      <p className="text-xs text-muted-foreground">
                        ₹{session.platform_fee as number} + ₹{session.venue_price as number}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
