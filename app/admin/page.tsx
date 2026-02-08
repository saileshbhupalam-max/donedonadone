"use client"

import useSWR from "swr"
import { Users, Building2, CalendarDays, Ticket, IndianRupee, AlertTriangle, Loader2 } from "lucide-react"
import { KpiCard } from "@/components/admin/kpi-card"
import { DailyBookingsChart } from "@/components/admin/daily-bookings-chart"
import { RevenueBreakdownChart } from "@/components/admin/revenue-breakdown-chart"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminOverviewPage() {
  const { data, isLoading } = useSWR("/api/admin/stats", fetcher)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const kpis = data?.kpis || {}
  const chartData = data?.chartData || []
  const alerts: { type: string; message: string }[] = data?.alerts || []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Admin Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform metrics and alerts at a glance
        </p>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map((alert, i) => (
            <Card key={i} className={`border-l-4 ${alert.type === "warning" ? "border-l-amber-500" : "border-l-blue-500"}`}>
              <CardContent className="flex items-center gap-3 p-3">
                <AlertTriangle className={`h-4 w-4 ${alert.type === "warning" ? "text-amber-500" : "text-blue-500"}`} />
                <p className="text-sm text-foreground">{alert.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={Users} value={kpis.totalUsers} label="Total Users" iconClassName="bg-primary/10 text-primary" />
        <KpiCard icon={Building2} value={kpis.totalVenues} label="Venues" iconClassName="bg-secondary/10 text-secondary" />
        <KpiCard icon={CalendarDays} value={kpis.totalSessions} label="Sessions" iconClassName="bg-blue-100 text-blue-600" />
        <KpiCard icon={Ticket} value={kpis.totalBookings} label="Bookings" iconClassName="bg-amber-100 text-amber-600" />
        <KpiCard icon={IndianRupee} value={formatCurrency(kpis.totalRevenue || 0)} label="Revenue" iconClassName="bg-teal-100 text-teal-700" />
        <KpiCard icon={Building2} value={kpis.pendingVenues} label="Pending Venues" iconClassName="bg-destructive/10 text-destructive" />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DailyBookingsChart data={chartData} />
        <RevenueBreakdownChart data={chartData} />
      </div>
    </div>
  )
}
