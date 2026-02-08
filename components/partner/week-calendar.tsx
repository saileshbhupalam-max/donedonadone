"use client"

import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

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
}

interface WeekCalendarProps {
  sessions: Session[]
  weekStart: Date
  onPrevWeek: () => void
  onNextWeek: () => void
  onSlotClick: (date: string, time: string) => void
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8AM - 8PM

function getWeekDays(start: Date): Date[] {
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

function dateStr(d: Date) {
  return d.toISOString().split("T")[0]
}

function timeToRow(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return (h - 8) * 2 + (m >= 30 ? 1 : 0)
}

function timeSpan(start: string, end: string): number {
  return timeToRow(end) - timeToRow(start)
}

export function WeekCalendar({
  sessions,
  weekStart,
  onPrevWeek,
  onNextWeek,
  onSlotClick,
}: WeekCalendarProps) {
  const days = getWeekDays(weekStart)
  const today = dateStr(new Date())

  const weekLabel = `${days[0].toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  })} – ${days[6].toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  })}`

  return (
    <div className="flex flex-col gap-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onPrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-foreground">{weekLabel}</span>
        <Button variant="ghost" size="icon" onClick={onNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-accent/30">
            <div className="p-2" />
            {days.map((d) => (
              <div
                key={dateStr(d)}
                className={`p-2 text-center text-xs font-medium ${
                  dateStr(d) === today
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <div>{d.toLocaleDateString("en-IN", { weekday: "short" })}</div>
                <div
                  className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                    dateStr(d) === today ? "bg-primary text-primary-foreground" : ""
                  }`}
                >
                  {d.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Time rows */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border last:border-0"
                style={{ height: "48px" }}
              >
                <div className="flex items-start justify-end pr-2 pt-1 text-[10px] text-muted-foreground">
                  {hour > 12
                    ? `${hour - 12}PM`
                    : hour === 12
                      ? "12PM"
                      : `${hour}AM`}
                </div>
                {days.map((d) => (
                  <div
                    key={`${dateStr(d)}-${hour}`}
                    className="relative border-l border-border hover:bg-accent/20 cursor-pointer"
                    onClick={() =>
                      onSlotClick(
                        dateStr(d),
                        `${String(hour).padStart(2, "0")}:00`
                      )
                    }
                  >
                    <div className="absolute inset-x-0 top-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity h-full">
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Session blocks overlay */}
            {sessions.map((session) => {
              const dayIndex = days.findIndex(
                (d) => dateStr(d) === session.session_date
              )
              if (dayIndex === -1) return null

              const row = timeToRow(session.start_time)
              const span = timeSpan(session.start_time, session.end_time)
              const filled =
                session.spots_filled ?? session.current_participants ?? 0
              const max =
                session.max_spots ?? session.max_participants ?? 0

              return (
                <div
                  key={session.id}
                  className={`absolute rounded px-1 py-0.5 text-[10px] font-medium ${
                    session.status === "cancelled"
                      ? "bg-gray-100 text-gray-500 line-through"
                      : "bg-teal-100 text-teal-800"
                  }`}
                  style={{
                    top: `${row * 24}px`,
                    height: `${span * 24 - 2}px`,
                    left: `calc(60px + ${dayIndex} * ((100% - 60px) / 7) + 2px)`,
                    width: `calc((100% - 60px) / 7 - 4px)`,
                  }}
                >
                  <div className="truncate">
                    {session.start_time?.slice(0, 5)}
                  </div>
                  <div className="truncate">
                    {filled}/{max}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
