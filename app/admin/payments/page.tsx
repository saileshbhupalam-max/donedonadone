"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, CreditCard, Check, X } from "lucide-react"
import { formatCurrency, formatTime } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminPaymentsPage() {
  const { data, isLoading, mutate } = useSWR("/api/admin/payments", fetcher)
  const [acting, setActing] = useState<string | null>(null)

  const payments = data?.payments || []

  const handleAction = async (bookingId: string, action: "verify" | "reject") => {
    setActing(bookingId)
    await fetch("/api/admin/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, action }),
    })
    mutate()
    setActing(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Payments</h2>
        <p className="mt-1 text-sm text-muted-foreground">Verify pending payments</p>
      </div>

      {payments.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No pending payments</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {payments.map((payment: Record<string, unknown>) => {
            const profile = payment.profiles as Record<string, unknown> | null
            const session = payment.sessions as Record<string, unknown> | null
            const venue = (session?.venues || null) as Record<string, unknown> | null

            return (
              <Card key={payment.id as string} className="border-border">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {profile?.display_name as string || "Unknown User"}
                        </p>
                        <Badge className="bg-amber-100 text-amber-800" variant="secondary">
                          {payment.payment_status as string}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{venue?.name as string || "Unknown Venue"}</span>
                        <span>{"·"}</span>
                        <span>
                          {session?.date
                            ? new Date(session.date as string).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                            : "N/A"}
                          {session?.start_time ? ` at ${formatTime(session.start_time as string)}` : ""}
                        </span>
                        <span>{"·"}</span>
                        <span className="font-semibold text-foreground">{formatCurrency(payment.payment_amount as number)}</span>
                      </div>
                      {payment.payment_reference ? (
                        <p className="text-xs text-muted-foreground">Ref: {String(payment.payment_reference)}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAction(payment.id as string, "verify")}
                        disabled={acting === payment.id}
                      >
                        {acting === payment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(payment.id as string, "reject")}
                        disabled={acting === payment.id}
                        className="text-destructive hover:bg-destructive/5"
                      >
                        <X className="mr-1 h-3 w-3" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
