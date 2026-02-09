import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { buildNotification } from "@/lib/notifications"

// Vercel Cron handler — runs every hour
// Checks for pending notifications to send
export async function GET(request: NextRequest) {
  // Verify cron secret (set in vercel.json)
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const now = new Date()
  const today = now.toISOString().split("T")[0]
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  const currentHour = now.getHours()
  const notifications: Parameters<typeof supabase.from>[0] extends string ? Record<string, unknown>[] : never[] = []

  // 1. 24h reminder (send at 10 AM for tomorrow's sessions)
  if (currentHour === 10) {
    const { data: tomorrowBookings } = await supabase
      .from("bookings")
      .select("user_id, sessions(date, start_time, venues(name))")
      .eq("sessions.date", tomorrow)
      .in("payment_status", ["paid", "confirmed"])
      .is("cancelled_at", null)

    for (const b of tomorrowBookings || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = (b as any).sessions
      if (!session) continue
      const notif = buildNotification(b.user_id, "reminder_24h", {
        venue: session.venues?.name || "your venue",
        time: session.start_time?.slice(0, 5) || "",
        date: tomorrow,
      }, { session_date: tomorrow })

      notifications.push(notif as never)
    }
  }

  // 2. Group reveal notification (1h before session)
  {
    const sessionHour = `${String(currentHour + 1).padStart(2, "0")}:00:00`
    const { data: upcomingSessions } = await supabase
      .from("sessions")
      .select("id, start_time, venues(name)")
      .eq("date", today)
      .gte("start_time", sessionHour)
      .lt("start_time", `${String(currentHour + 2).padStart(2, "0")}:00:00`)

    for (const session of upcomingSessions || []) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("user_id")
        .eq("session_id", session.id)
        .in("payment_status", ["paid", "confirmed"])
        .is("cancelled_at", null)

      for (const b of bookings || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const notif = buildNotification(b.user_id, "group_reveal", {
          venue: (session as any).venues?.name || "your venue",
        }, { session_id: session.id })
        notifications.push(notif as never)
      }
    }
  }

  // 3. Streak at risk (Thursday at 6 PM — if no booking this week)
  if (now.getDay() === 4 && currentHour === 18) {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
    const weekStartStr = weekStart.toISOString().split("T")[0]

    const { data: activeStreakers } = await supabase
      .from("user_streaks")
      .select("user_id, current_streak")
      .gt("current_streak", 0)

    for (const streaker of activeStreakers || []) {
      // Check if they have a booking this week
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", streaker.user_id)
        .in("payment_status", ["paid", "confirmed"])
        .gte("created_at", weekStartStr)

      if ((count || 0) === 0) {
        const notif = buildNotification(streaker.user_id, "streak_at_risk", {
          streak: String(streaker.current_streak),
        })
        notifications.push(notif as never)
      }
    }
  }

  // Batch insert all notifications
  if (notifications.length > 0) {
    const rows = notifications.map((n) => ({
      ...n,
      sent_at: now.toISOString(),
    }))

    await supabase.from("notifications").insert(rows)
  }

  return NextResponse.json({
    processed: notifications.length,
    timestamp: now.toISOString(),
  })
}
