"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, X } from "lucide-react"
import { platformFee as calcPlatformFee } from "@/lib/config"

const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8
  const min = i % 2 === 0 ? "00" : "30"
  return `${String(hour).padStart(2, "0")}:${min}`
}).filter((t) => {
  const h = parseInt(t.split(":")[0])
  return h >= 8 && h <= 20
})

interface CreateSessionModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  prefillDate?: string
  prefillTime?: string
}

export function CreateSessionModal({
  open,
  onClose,
  onCreated,
  prefillDate,
  prefillTime,
}: CreateSessionModalProps) {
  const [date, setDate] = useState(
    prefillDate || new Date().toISOString().split("T")[0]
  )
  const [startTime, setStartTime] = useState(prefillTime || "10:00")
  const [duration, setDuration] = useState<2 | 4>(2)
  const [maxSpots, setMaxSpots] = useState(20)
  const [venuePrice, setVenuePrice] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fee = calcPlatformFee(duration)
  const totalPrice = fee + venuePrice

  // Calculate end time for display
  const [h, m] = startTime.split(":").map(Number)
  const endH = h + duration
  const endTime = `${String(endH).padStart(2, "0")}:${String(m).padStart(
    2,
    "0"
  )}`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const res = await fetch("/api/partner/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_date: date,
        start_time: startTime,
        duration_hours: duration,
        max_spots: maxSpots,
        venue_price: venuePrice,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || "Failed to create session")
    } else {
      onCreated()
      onClose()
    }

    setSaving(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Create Session
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="session-date">Date</Label>
            <Input
              id="session-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="start-time">Start Time</Label>
            <select
              id="start-time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Duration</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDuration(2)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  duration === 2
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                2 hours
              </button>
              <button
                type="button"
                onClick={() => setDuration(4)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  duration === 4
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                4 hours
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="max-spots">Max Spots</Label>
            <Input
              id="max-spots"
              type="number"
              min={1}
              max={50}
              value={maxSpots}
              onChange={(e) => setMaxSpots(Number(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="venue-price">Your Venue Charge ({"\u20B9"})</Label>
            <Input
              id="venue-price"
              type="number"
              min={0}
              value={venuePrice}
              onChange={(e) => setVenuePrice(Number(e.target.value))}
            />
          </div>

          {/* Price Preview */}
          <div className="rounded-lg bg-accent/50 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Price Preview
            </p>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Time: {startTime} – {endTime}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform fee</span>
                <span>{"\u20B9"}{fee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Venue charge</span>
                <span>{"\u20B9"}{venuePrice}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                <span>Total per person</span>
                <span>{"\u20B9"}{totalPrice}</span>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Session"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
