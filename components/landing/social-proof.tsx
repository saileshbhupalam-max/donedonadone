import { Button } from "@/components/ui/button"
import { ArrowRight, MapPin, Clock, Users } from "lucide-react"
import Link from "next/link"

const highlights = [
  { icon: Users, label: "Small groups of 3-5" },
  { icon: Clock, label: "2 or 4-hour sessions" },
  { icon: MapPin, label: "Curated HSR Layout venues" },
]

export function SocialProof() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 lg:px-6 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Cowork with your people in HSR Layout
          </h2>
          <p className="mt-3 text-muted-foreground">
            Stop working alone — get matched with a small group at a great cafe and actually get stuff done
          </p>

          {/* Highlights */}
          <div className="mt-10 grid grid-cols-3 gap-6">
            {highlights.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <Button size="lg" className="mt-10" asChild>
            <Link href="/auth/sign-up">
              Start coworking today
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
