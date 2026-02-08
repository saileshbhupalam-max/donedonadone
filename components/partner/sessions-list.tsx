"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarDays, Clock, Users, Trash2, Loader2 } from "lucide-react"

interface Session {
  id: string
  session_date: string
  start_time: string
  end_time: string
  status: string
  current_participants?: number
  max_participants?: number
  spots_filled?: number
  max_spots?: number
  venue_price?: number
  platform_fee?: number
  total_price?: number
  duration_hours?: number
}

interface SessionsListProps {
  sessions: Session[]
  onRefresh: () => void
}

export function SessionsList({ sessions, onRefresh }: SessionsListProps) {
  const [cancelling, setCancelling] = useState<string | null>(null)

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this session? This cannot be undone.")) return

    setCancelling(id)
    const res = await fetch(`/api/partner/sessions/${id}`, {
      method: "DELETE",
    })
    if (res.ok) {
      onRefresh()
    }
    setCancelling(null)
  }

  if (sessions.length === 0) {
    return (
      <div className="py-10 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/30" />
        <p className="mt-2 text-sm text-muted-foreground">No sessions found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((session) => {
        const filled =
          session.spots_filled ?? session.current_participants ?? 0
        const max = session.max_spots ?? session.max_participants ?? 0
        const isCancelled = session.status === "cancelled"

        return (
          <Card
            key={session.id}
            className={`border-border ${isCancelled ? "opacity-50" : ""}`}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(session.session_date).toLocaleDateString(
                      "en-IN",
                      {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      }
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {session.start_time?.slice(0, 5)} –{" "}
                    {session.end_time?.slice(0, 5)}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {filled}/{max}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      isCancelled
                        ? "bg-gray-100 text-gray-500"
                        : session.status === "in_progress"
                          ? "bg-green-100 text-green-800"
                          : session.status === "completed"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-teal-100 text-teal-800"
                    }`}
                  >
                    {isCancelled
                      ? "Cancelled"
                      : session.status === "in_progress"
                        ? "Live"
                        : session.status === "completed"
                          ? "Completed"
                          : "Upcoming"}
                  </span>
                  {session.total_price != null && (
                    <span className="text-xs text-muted-foreground">
                      {"\u20B9"}{session.total_price}/person
                    </span>
                  )}
                </div>
              </div>

              {!isCancelled && session.status === "upcoming" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCancel(session.id)}
                  disabled={cancelling === session.id}
                  className="text-muted-foreground hover:text-red-500"
                >
                  {cancelling === session.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
