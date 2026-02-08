import { CalendarDays, Clock, MapPin, ExternalLink } from "lucide-react"
import { formatDate, formatTime } from "@/lib/format"

interface SessionHeaderProps {
  venueName: string
  venueAddress?: string
  date: string
  startTime: string
  endTime: string
  lat?: number | null
  lng?: number | null
}

export function SessionHeader({
  venueName,
  venueAddress,
  date,
  startTime,
  endTime,
  lat,
  lng,
}: SessionHeaderProps) {
  const mapsUrl = lat && lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <h2 className="text-xl font-bold text-foreground">{venueName}</h2>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        {venueAddress && (
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            {venueAddress}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"
              >
                Directions <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </span>
        )}
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          {formatDate(date, "long")}
        </span>
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {formatTime(startTime)} - {formatTime(endTime)}
        </span>
      </div>
    </div>
  )
}
