import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/admin"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isAdmin = await verifyAdmin(supabase, user.id)
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const today = new Date().toISOString().split("T")[0]

  // KPIs — run in parallel
  const [
    { count: totalUsers },
    { count: totalVenues },
    { count: totalSessions },
    { count: totalBookings },
    { data: revenueData },
    { count: pendingVenues },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("venues").select("*", { count: "exact", head: true }),
    supabase.from("sessions").select("*", { count: "exact", head: true }),
    supabase.from("bookings").select("*", { count: "exact", head: true }).neq("payment_status", "cancelled"),
    supabase.from("bookings").select("payment_amount").in("payment_status", ["paid", "confirmed"]),
    supabase.from("venues").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ])

  const totalRevenue = (revenueData || []).reduce((sum, b) => sum + (b.payment_amount || 0), 0)

  // 30-day chart data — bookings per day
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
  const { data: chartBookings } = await supabase
    .from("bookings")
    .select("created_at")
    .gte("created_at", thirtyDaysAgo)
    .neq("payment_status", "cancelled")

  const dailyCounts: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0]
    dailyCounts[d] = 0
  }
  for (const b of chartBookings || []) {
    const d = b.created_at?.split("T")[0]
    if (d && d in dailyCounts) dailyCounts[d]++
  }

  const chartData = Object.entries(dailyCounts).map(([date, count]) => ({
    date,
    bookings: count,
  }))

  // Alerts
  const alerts: { type: string; message: string }[] = []
  if ((pendingVenues || 0) > 0) {
    alerts.push({ type: "warning", message: `${pendingVenues} venue(s) awaiting approval` })
  }

  // Today's sessions
  const { count: todaySessions } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("date", today)

  if ((todaySessions || 0) > 0) {
    alerts.push({ type: "info", message: `${todaySessions} session(s) scheduled today` })
  }

  return NextResponse.json({
    kpis: {
      totalUsers: totalUsers || 0,
      totalVenues: totalVenues || 0,
      totalSessions: totalSessions || 0,
      totalBookings: totalBookings || 0,
      totalRevenue,
      pendingVenues: pendingVenues || 0,
    },
    chartData,
    alerts,
  })
}
