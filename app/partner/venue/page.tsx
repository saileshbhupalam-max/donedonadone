"use client"

import { useEffect, useState } from "react"
import { VenueForm } from "@/components/partner/venue-form"
import { Loader2 } from "lucide-react"
import type { Venue } from "@/lib/types"

export default function VenuePage() {
  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/partner/venue")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setVenue(data.venue)
        }
      })
      .catch(() => setError("Failed to load venue"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !venue) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">
          {error || "No venue found. Contact admin to set up your venue."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">My Venue</h2>
        <p className="text-sm text-muted-foreground">
          Manage your venue details and amenities
        </p>
      </div>
      <VenueForm venue={venue} />
    </div>
  )
}
