"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IndianRupee, TrendingUp, Wallet, Loader2 } from "lucide-react"
import { EarningsChart } from "@/components/partner/earnings-chart"

interface EarningsData {
  thisMonth: number
  lastMonth: number
  allTime: number
  dailyBreakdown: { date: string; amount: number }[]
}

export default function EarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/partner/earnings")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">Failed to load earnings</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Earnings</h2>
        <p className="text-sm text-muted-foreground">
          Track your venue revenue and payouts
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <IndianRupee className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {"\u20B9"}{data.thisMonth}
              </p>
              <p className="text-xs text-muted-foreground">This month</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100">
              <TrendingUp className="h-5 w-5 text-teal-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {"\u20B9"}{data.lastMonth}
              </p>
              <p className="text-xs text-muted-foreground">Last month</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <Wallet className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {"\u20B9"}{data.allTime}
              </p>
              <p className="text-xs text-muted-foreground">All time</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Earnings Chart */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Daily Earnings (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.dailyBreakdown.length > 0 ? (
            <EarningsChart data={data.dailyBreakdown} />
          ) : (
            <div className="flex items-center justify-center py-10">
              <p className="text-sm text-muted-foreground">No earnings data yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout History Placeholder */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Wallet className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Payout tracking coming soon
            </p>
            <p className="text-xs text-muted-foreground">
              Payouts will be processed weekly via bank transfer
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
