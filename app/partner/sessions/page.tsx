"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Plus, CalendarDays, List, Loader2 } from "lucide-react"
import { WeekCalendar } from "@/components/partner/week-calendar"
import { SessionsList } from "@/components/partner/sessions-list"
import { CreateSessionModal } from "@/components/partner/create-session-modal"

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

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

export default function SessionsPage() {
  const [view, setView] = useState<"calendar" | "list">("calendar")
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [prefillDate, setPrefillDate] = useState<string | undefined>()
  const [prefillTime, setPrefillTime] = useState<string | undefined>()

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const weekStr = weekStart.toISOString().split("T")[0]
    const res = await fetch(`/api/partner/sessions?week_start=${weekStr}`)
    const data = await res.json()
    setSessions(data.sessions || [])
    setLoading(false)
  }, [weekStart])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleSlotClick = (date: string, time: string) => {
    setPrefillDate(date)
    setPrefillTime(time)
    setModalOpen(true)
  }

  const handlePrevWeek = () => {
    const prev = new Date(weekStart)
    prev.setDate(prev.getDate() - 7)
    setWeekStart(prev)
  }

  const handleNextWeek = () => {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + 7)
    setWeekStart(next)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Sessions</h2>
          <p className="text-sm text-muted-foreground">
            Manage your coworking sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border">
            <button
              onClick={() => setView("calendar")}
              className={`rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "calendar"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <CalendarDays className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "list"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setPrefillDate(undefined)
              setPrefillTime(undefined)
              setModalOpen(true)
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Session
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : view === "calendar" ? (
        <WeekCalendar
          sessions={sessions}
          weekStart={weekStart}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
          onSlotClick={handleSlotClick}
        />
      ) : (
        <SessionsList sessions={sessions} onRefresh={fetchSessions} />
      )}

      <CreateSessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={fetchSessions}
        prefillDate={prefillDate}
        prefillTime={prefillTime}
      />
    </div>
  )
}
