"use client"

import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Loader2, Coffee } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const PLAN_FEATURES: Record<string, string[]> = {
  Explorer: [
    "4 sessions per month",
    "Standard group matching",
    "Session goals & accountability",
    "Coworker Score tracking",
  ],
  Regular: [
    "8 sessions per month",
    "Priority group matching",
    "1 streak freeze per month",
    "Session goals & accountability",
    "Coworker Score tracking",
  ],
  Pro: [
    "Unlimited sessions",
    "Priority group matching",
    "2 streak freezes per month",
    "Exclusive venue access",
    "Session goals & accountability",
    "Coworker Score tracking",
  ],
}

export default function PricingPage() {
  const { data, isLoading } = useSWR("/api/subscriptions", fetcher)
  const [subscribing, setSubscribing] = useState<string | null>(null)

  const plans = data?.plans || []
  const currentSub = data?.subscription

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId)
    try {
      await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      })
      window.location.reload()
    } finally {
      setSubscribing(null)
    }
  }

  return (
    <div className="flex min-h-svh w-full flex-col items-center bg-background px-6 py-10">
      <div className="flex flex-col items-center gap-2">
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <Coffee className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">donedonadone</span>
        </Link>
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold text-foreground">Choose Your Plan</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Subscribe for the best value. Save up to 40% compared to per-session pricing.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-10 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
          {plans.map((plan: Record<string, unknown>) => {
            const isCurrentPlan = currentSub?.plan_id === plan.id
            const isPopular = plan.name === "Regular"
            const features = PLAN_FEATURES[plan.name as string] || []

            return (
              <Card
                key={plan.id as string}
                className={`relative border-border transition-shadow hover:shadow-lg ${
                  isPopular ? "border-2 border-primary" : ""
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-lg text-foreground">{plan.name as string}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-foreground">
                      {"\u20B9"}{plan.price as number}
                    </span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(plan.sessions_per_month as number | null)
                      ? `${plan.sessions_per_month} sessions`
                      : "Unlimited sessions"}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <ul className="flex flex-col gap-2">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isPopular ? "default" : "outline"}
                    disabled={isCurrentPlan || subscribing === (plan.id as string)}
                    onClick={() => handleSubscribe(plan.id as string)}
                  >
                    {isCurrentPlan
                      ? "Current Plan"
                      : subscribing === (plan.id as string)
                        ? "Processing..."
                        : "Subscribe"}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="mt-10 text-center">
        <p className="text-sm text-muted-foreground">
          Or pay per session: {"\u20B9"}100 (2hr) / {"\u20B9"}150 (4hr) platform fee + venue price
        </p>
        <Button variant="ghost" size="sm" className="mt-2" asChild>
          <Link href="/dashboard/sessions">Browse sessions instead</Link>
        </Button>
      </div>
    </div>
  )
}
