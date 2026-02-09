"use client"

import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import {
  Loader2,
  CalendarCheck,
  Users,
  MapPin,
  Hourglass,
  Flame,
  Target,
  Trophy,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function WrappedPage() {
  const { data, isLoading } = useSWR("/api/wrapped", fetcher)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || data.error) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">Failed to load summary</p>
      </div>
    )
  }

  const stats = [
    { icon: CalendarCheck, label: "Sessions", value: data.sessionsAttended, color: "text-primary bg-primary/10" },
    { icon: Hourglass, label: "Hours Focused", value: data.hoursFocused, color: "text-amber-600 bg-amber-100" },
    { icon: Users, label: "People Met", value: data.peopleMet, color: "text-secondary bg-secondary/10" },
    { icon: MapPin, label: "Venues Visited", value: data.venuesVisited, color: "text-teal-700 bg-teal-100" },
    { icon: Flame, label: "Current Streak", value: `${data.currentStreak}w`, color: "text-orange-600 bg-orange-100" },
    { icon: Target, label: "Goals Completed", value: `${data.goalCompletionRate}%`, color: "text-violet-600 bg-violet-100" },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-br from-secondary to-teal-700 p-6 text-center text-white">
        <p className="text-xs font-medium uppercase tracking-wider text-teal-200">
          Your Monthly Summary
        </p>
        <h2 className="mt-2 text-2xl font-bold">{data.month}</h2>
        <p className="mt-1 text-sm text-teal-100">
          Here&apos;s what you accomplished this month
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border">
            <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Venues visited */}
      {data.venueNames && data.venueNames.length > 0 && (
        <Card className="border-border">
          <CardContent className="p-4">
            <h4 className="mb-2 text-sm font-medium text-foreground">Venues You Visited</h4>
            <div className="flex flex-wrap gap-2">
              {data.venueNames.map((name: string) => (
                <span
                  key={name}
                  className="rounded-full border border-border px-3 py-1 text-xs text-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Coworkers */}
      {data.topCoworkers && data.topCoworkers.length > 0 && (
        <Card className="border-border">
          <CardContent className="p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top Coworkers You Loved
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.topCoworkers.map((c: { name: string }, i: number) => (
                <span
                  key={i}
                  className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {c.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streak info */}
      {data.longestStreak > 0 && (
        <Card className="border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
              <Flame className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                {data.longestStreak}-week longest streak
              </p>
              <p className="text-sm text-muted-foreground">
                {data.currentStreak > 0
                  ? `Currently on a ${data.currentStreak}-week streak. Keep going!`
                  : "Start a new streak this week!"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
