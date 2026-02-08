import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"
import Link from "next/link"

const plans = [
  {
    title: "Focus Session",
    duration: "2 hours",
    price: "299-499",
    popular: false,
    features: [
      "Group of 3-5 matched coworkers",
      "Curated cafe or coworking space",
      "Wifi + power outlets guaranteed",
      "Post-session feedback & ratings",
    ],
  },
  {
    title: "Deep Work Session",
    duration: "4 hours",
    price: "499-799",
    popular: true,
    features: [
      "Everything in Focus Session",
      "Extended deep work block",
      "Complimentary coffee/tea at select venues",
      "Priority matching algorithm",
      "Group chat before session",
    ],
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-20 lg:px-6 lg:py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-3 text-muted-foreground">
            Pay per session. Price includes platform fee + venue charge.
          </p>
        </div>

        <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <Card
              key={plan.title}
              className={`relative border-border ${
                plan.popular ? "ring-2 ring-primary" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  Most popular
                </div>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-foreground">{plan.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.duration}</p>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-foreground">
                    {"₹"}{plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {" "}/ session
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={plan.popular ? "default" : "outline"}
                  asChild
                >
                  <Link href="/auth/sign-up">Get started</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
