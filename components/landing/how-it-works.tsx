import { CalendarDays, Users, Laptop } from "lucide-react"

const steps = [
  {
    icon: CalendarDays,
    title: "Pick a session",
    description:
      "Browse upcoming sessions at cafes and coworking spaces near you. Choose a time that fits your schedule.",
    step: "01",
  },
  {
    icon: Users,
    title: "Get grouped",
    description:
      "Our matching algorithm pairs you with 3-5 compatible coworkers based on your work style and preferences.",
    step: "02",
  },
  {
    icon: Laptop,
    title: "Show up & do the work",
    description:
      "Arrive at the venue, meet your group, and enjoy a focused coworking session. Rate the experience after.",
    step: "03",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-20 lg:px-6 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-muted-foreground">
            From booking to coworking in three simple steps
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.step} className="relative flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <step.icon className="h-6 w-6 text-primary" />
              </div>
              <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-secondary">
                Step {step.step}
              </span>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
