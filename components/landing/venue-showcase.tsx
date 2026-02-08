import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Wifi, Plug, Coffee, ArrowRight } from "lucide-react"
import Link from "next/link"

const venues = [
  {
    name: "Third Wave Coffee",
    type: "Cafe",
    amenities: ["wifi", "power", "coffee"],
    color: "bg-amber-800",
  },
  {
    name: "Dialogues Cafe",
    type: "Cafe",
    amenities: ["wifi", "power", "coffee"],
    color: "bg-teal-800",
  },
  {
    name: "Blue Tokai",
    type: "Cafe",
    amenities: ["wifi", "power", "coffee"],
    color: "bg-stone-700",
  },
  {
    name: "Commune Cowork",
    type: "Coworking",
    amenities: ["wifi", "power", "coffee"],
    color: "bg-amber-700",
  },
  {
    name: "91springboard",
    type: "Coworking",
    amenities: ["wifi", "power", "coffee"],
    color: "bg-teal-700",
  },
  {
    name: "The Hive",
    type: "Coworking",
    amenities: ["wifi", "power", "coffee"],
    color: "bg-stone-800",
  },
]

const amenityIcons: Record<string, typeof Wifi> = {
  wifi: Wifi,
  power: Plug,
  coffee: Coffee,
}

export function VenueShowcase() {
  return (
    <section id="venues">
      <div className="mx-auto max-w-6xl px-4 py-20 lg:px-6 lg:py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Curated venues in HSR Layout
          </h2>
          <p className="mt-3 text-muted-foreground">
            Hand-picked cafes and coworking spaces with great wifi, good coffee,
            and the right vibe
          </p>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
          {venues.map((venue) => (
            <Card
              key={venue.name}
              className="min-w-[260px] shrink-0 overflow-hidden border-border transition-shadow hover:shadow-md md:min-w-0"
            >
              <div
                className={`${venue.color} flex h-36 items-end p-4`}
              >
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-white/80" />
                  <span className="text-xs font-medium text-white/80">
                    HSR Layout
                  </span>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {venue.name}
                    </h3>
                    <Badge
                      variant="secondary"
                      className="mt-1 text-xs"
                    >
                      {venue.type}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {venue.amenities.map((amenity) => {
                    const Icon = amenityIcons[amenity]
                    return Icon ? (
                      <Icon
                        key={amenity}
                        className="h-4 w-4 text-muted-foreground"
                      />
                    ) : null
                  })}
                </div>
                <Link
                  href="/auth/sign-up"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  View sessions
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
