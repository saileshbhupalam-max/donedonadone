"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface RevenueBreakdownChartProps {
  data: { date: string; bookings: number }[]
}

export function RevenueBreakdownChart({ data }: RevenueBreakdownChartProps) {
  // Estimate: avg platform fee ₹100, avg venue fee ₹100 per booking
  const chartData = data.map((d) => ({
    date: d.date,
    platform: d.bookings * 100,
    venue: d.bookings * 100,
  }))

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Revenue Breakdown (30 days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
                formatter={(value: number) => [`₹${value}`, ""]}
              />
              <Legend />
              <Bar dataKey="platform" stackId="a" fill="hsl(var(--primary))" name="Platform" />
              <Bar dataKey="venue" stackId="a" fill="hsl(var(--secondary))" name="Venue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
