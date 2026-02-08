"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarDays, Clock, MapPin } from "lucide-react"
import { VIBE_CONFIG, AMENITY_ICONS, AMENITY_LABELS, PLATFORM_FEE_2HR } from "@/lib/config"

interface SessionCardProps {
  session: {
    id: string
    title: string
    description: string
    session_date: string
    start_time: string
    end_time: string
    max_participants: number
    current_participants: number
    vibe: string
    price: number
    venues: {
      name: string
      address: string
      city: string
      amenities: string[]
      wifi_speed_mbps: number | null
      type: string
    } | null
  }
  onBook: (sessionId: string) => void
  isBooked?: boolean
  isLoading?: boolean
}

export function SessionCard({
  session,
  onBook,
  isBooked,
  isLoading,
}: SessionCardProps) {
  const vibe = VIBE_CONFIG[session.vibe] || VIBE_CONFIG.balanced
  const price = Number(session.price)
  const venueFee = Math.max(price - PLATFORM_FEE_2HR, 0)
  const spotsPercent =
    (session.current_participants / session.max_participants) * 100
  const spotsLeft = session.max_participants - session.current_participants
  const isFull = spotsLeft <= 0

  return (
    <Card className="flex flex-col border-border transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug text-foreground">
            {session.title}
          </CardTitle>
          <Badge className={vibe.className} variant="secondary">
            {vibe.label}
          </Badge>
        </div>
        {session.venues && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{session.venues.name}</span>
            <span className="text-border">{"·"}</span>
            <span className="truncate text-xs">{session.venues.address}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {session.description}
        </p>

        {/* Date and time */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date(session.session_date).toLocaleDateString("en-IN", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {session.start_time?.slice(0, 5)} -{" "}
            {session.end_time?.slice(0, 5)}
          </span>
        </div>

        {/* Amenity chips */}
        {session.venues?.amenities && session.venues.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {session.venues.amenities.slice(0, 5).map((amenity) => {
              const Icon = AMENITY_ICONS[amenity]
              return (
                <span
                  key={amenity}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  title={AMENITY_LABELS[amenity] || amenity}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {AMENITY_LABELS[amenity] || amenity}
                </span>
              )
            })}
            {session.venues.amenities.length > 5 && (
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                +{session.venues.amenities.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Spots progress bar */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {session.current_participants}/{session.max_participants} spots
              filled
            </span>
            <span
              className={
                isFull
                  ? "font-medium text-destructive"
                  : spotsLeft <= 2
                    ? "font-medium text-amber-600"
                    : "text-muted-foreground"
              }
            >
              {isFull ? "Full" : `${spotsLeft} left`}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                isFull
                  ? "bg-destructive"
                  : spotsPercent >= 75
                    ? "bg-amber-500"
                    : "bg-secondary"
              }`}
              style={{ width: `${Math.min(spotsPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Price and book button */}
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <span className="text-xl font-bold text-foreground">
              {"₹"}{price.toFixed(0)}
            </span>
            <p className="text-[11px] leading-tight text-muted-foreground">
              {"₹"}{PLATFORM_FEE_2HR} platform + {"₹"}{venueFee.toFixed(0)} venue
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => onBook(session.id)}
            disabled={isFull || isBooked || isLoading}
          >
            {isLoading
              ? "Booking..."
              : isBooked
                ? "Booked"
                : isFull
                  ? "Full"
                  : "Book now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
