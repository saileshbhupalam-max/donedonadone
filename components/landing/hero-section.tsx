import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Users, MapPin } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-20 lg:px-6 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          {/* Pill badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5">
            <MapPin className="h-3.5 w-3.5 text-secondary" />
            <span className="text-xs font-medium text-muted-foreground">
              Now in HSR Layout, Bangalore
            </span>
          </div>

          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Stop working alone.{" "}
            <span className="text-primary">Start working together.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Join a small group of 3-5 people at curated cafes and coworking
            spaces in HSR Layout. Book a 2 or 4-hour session, show up, get
            stuff done.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/auth/sign-up">
                Browse Sessions
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <a href="#how-it-works">How it works</a>
            </Button>
          </div>

          {/* Quick stats */}
          <div className="mt-14 flex items-center justify-center gap-8 sm:gap-12">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-foreground">3-5</span>
              <span className="text-xs text-muted-foreground">
                People per group
              </span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-foreground">2-4hr</span>
              <span className="text-xs text-muted-foreground">
                Session length
              </span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-secondary" />
                <span className="text-2xl font-bold text-foreground">
                  1000+
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Coworkers joined
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>
    </section>
  )
}
