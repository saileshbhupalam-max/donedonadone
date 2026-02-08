import { Card, CardContent } from "@/components/ui/card"
import type React from "react"

interface KpiCardProps {
  icon: React.ElementType
  value: string | number
  label: string
  iconClassName?: string
}

export function KpiCard({ icon: Icon, value, label, iconClassName = "bg-primary/10 text-primary" }: KpiCardProps) {
  return (
    <Card className="border-border">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
