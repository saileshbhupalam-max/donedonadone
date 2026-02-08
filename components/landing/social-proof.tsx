import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

const stats = [
  { value: "500+", label: "Sessions hosted" },
  { value: "2,000+", label: "Groups formed" },
  { value: "12", label: "Partner venues" },
]

export function SocialProof() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 lg:px-6 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Join 1,000+ coworkers in HSR Layout
          </h2>
          <p className="mt-3 text-muted-foreground">
            People who stopped working alone and started getting more done together
          </p>

          {/* Overlapping avatars */}
          <div className="mt-8 flex items-center justify-center">
            <div className="flex -space-x-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground"
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <span className="ml-3 text-sm text-muted-foreground">
              +994 others
            </span>
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground sm:text-3xl">
                  {stat.value}
                </span>
                <span className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {stat.label}
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
