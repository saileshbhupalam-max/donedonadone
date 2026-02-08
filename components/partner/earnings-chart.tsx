"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

interface DailyData {
  date: string
  amount: number
}

interface EarningsChartProps {
  data: DailyData[]
}

export function EarningsChart({ data }: EarningsChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    }),
  }))

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `₹${v}`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length > 0) {
                const item = payload[0].payload
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
                    <p className="text-xs text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {"\u20B9"}{item.amount}
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar
            dataKey="amount"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
