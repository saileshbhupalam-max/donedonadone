"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save } from "lucide-react"

const AMENITY_OPTIONS = [
  "WiFi",
  "Power Outlets",
  "AC",
  "Parking",
  "Coffee Included",
  "Snacks",
  "Meeting Room",
  "Standing Desks",
  "Lockers",
  "Printer",
]

const VENUE_TYPES = [
  { value: "cafe", label: "Cafe" },
  { value: "coworking_space", label: "Coworking Space" },
  { value: "other", label: "Other" },
]

interface Venue {
  id: string
  name: string
  address: string
  area: string
  venue_type: string
  amenities: string[]
  included_in_cover: string | null
  venue_rules: string | null
  max_capacity: number
  photos: string[]
  status: string
}

interface VenueFormProps {
  venue: Venue
}

export function VenueForm({ venue }: VenueFormProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(venue.name)
  const [address, setAddress] = useState(venue.address)
  const [area, setArea] = useState(venue.area)
  const [venueType, setVenueType] = useState(venue.venue_type)
  const [amenities, setAmenities] = useState<string[]>(venue.amenities || [])
  const [includedInCover, setIncludedInCover] = useState(
    venue.included_in_cover || ""
  )
  const [venueRules, setVenueRules] = useState(venue.venue_rules || "")
  const [maxCapacity, setMaxCapacity] = useState(venue.max_capacity)

  const toggleAmenity = (amenity: string) => {
    setAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)

    const res = await fetch("/api/partner/venue", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        address,
        area,
        venue_type: venueType,
        amenities,
        included_in_cover: includedInCover || null,
        venue_rules: venueRules || null,
        max_capacity: maxCapacity,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || "Failed to save")
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }

    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Venue Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="area">Area</Label>
              <Input
                id="area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="capacity">Max Capacity</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Venue Type</Label>
            <div className="flex gap-2">
              {VENUE_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setVenueType(type.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    venueType === type.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Amenities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {AMENITY_OPTIONS.map((amenity) => (
              <button
                key={amenity}
                type="button"
                onClick={() => toggleAmenity(amenity)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  amenities.includes(amenity)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {amenity}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cover">Included in Cover</Label>
            <textarea
              id="cover"
              value={includedInCover}
              onChange={(e) => setIncludedInCover(e.target.value)}
              className="min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g., 1 coffee, WiFi, power outlet"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rules">Venue Rules</Label>
            <textarea
              id="rules"
              value={venueRules}
              onChange={(e) => setVenueRules(e.target.value)}
              className="min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g., No outside food, keep noise low"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Photo upload coming soon
            </p>
            {venue.photos && venue.photos.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {venue.photos.length} photo(s) uploaded
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <Button type="submit" disabled={saving} className="self-end">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
          </>
        ) : saved ? (
          "Saved!"
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </>
        )}
      </Button>
    </form>
  )
}
