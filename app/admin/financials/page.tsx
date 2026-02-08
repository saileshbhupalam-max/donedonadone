"use client"

import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, IndianRupee, TrendingUp, Building2, RotateCcw } from "lucide-react"
import { KpiCard } from "@/components/admin/kpi-card"
import { formatCurrency } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminFinancialsPage() {
  const { data, isLoading } = useSWR("/api/admin/financials", fetcher)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const kpis = data?.kpis || {}
  const transactions: Record<string, unknown>[] = data?.transactions || []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Financials</h2>
        <p className="mt-1 text-sm text-muted-foreground">Revenue, fees, and payout tracking</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={IndianRupee} value={formatCurrency(kpis.totalRevenue || 0)} label="Total Revenue" iconClassName="bg-primary/10 text-primary" />
        <KpiCard icon={TrendingUp} value={formatCurrency(kpis.totalPlatformFees || 0)} label="Platform Fees" iconClassName="bg-teal-100 text-teal-700" />
        <KpiCard icon={Building2} value={formatCurrency(kpis.totalVenuePayouts || 0)} label="Venue Payouts" iconClassName="bg-secondary/10 text-secondary" />
        <KpiCard icon={RotateCcw} value={formatCurrency(kpis.totalRefunds || 0)} label="Refunds" iconClassName="bg-destructive/10 text-destructive" />
      </div>

      {/* Transaction table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Venue</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2 pr-4">Platform</th>
                    <th className="pb-2 pr-4">Venue</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id as string} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {new Date(tx.date as string).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-foreground">{tx.venueName as string}</td>
                      <td className="py-2.5 pr-4 font-semibold text-foreground">₹{tx.amount as number}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">₹{tx.platformFee as number}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">₹{tx.venuePrice as number}</td>
                      <td className="py-2.5">
                        <Badge className="bg-teal-100 text-teal-800" variant="secondary">
                          {tx.status as string}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
