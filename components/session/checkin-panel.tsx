"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle2, Circle, MapPin } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface CheckinPanelProps {
  sessionId: string
}

export function CheckinPanel({ sessionId }: CheckinPanelProps) {
  const { data, isLoading, mutate } = useSWR(
    `/api/session/${sessionId}/checkin`,
    fetcher,
    { refreshInterval: 10000 }
  )
  const [checking, setChecking] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const getLocation = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null) // Geolocation not supported, allow check-in without
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null), // Permission denied or error, allow check-in without
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }, [])

  const handleCheckin = async () => {
    setChecking(true)
    setGeoError(null)

    const coords = await getLocation()

    const res = await fetch(`/api/session/${sessionId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coords || {}),
    })

    if (res.ok) {
      mutate()
    } else {
      const data = await res.json().catch(() => ({}))
      setGeoError(data.error || "Check-in failed")
    }
    setChecking(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (data?.error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">{data.error}</p>
      </div>
    )
  }

  const booking = data?.booking
  const members: Record<string, unknown>[] = data?.members || []
  const session = data?.session
  const isCheckedIn = booking?.checked_in

  return (
    <div className="flex flex-col gap-6">
      {/* Session info */}
      {session && (
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">{session.venues?.name}</h2>
          <p className="text-sm text-muted-foreground">
            {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
          </p>
        </div>
      )}

      {/* Check-in button */}
      <div className="flex flex-col items-center gap-4">
        {isCheckedIn ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary/10">
              <CheckCircle2 className="h-12 w-12 text-secondary" />
            </div>
            <p className="text-lg font-semibold text-foreground">Checked In!</p>
            <p className="text-sm text-muted-foreground">
              at {new Date(booking.checked_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleCheckin}
              disabled={checking}
              className="flex h-32 w-32 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {checking ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <MapPin className="h-8 w-8" />
                  <span className="text-sm font-semibold">Check In</span>
                </div>
              )}
            </button>
            <p className="text-sm text-muted-foreground">
              Tap to check in at venue
            </p>
            {geoError && (
              <p className="max-w-xs text-center text-sm text-destructive">{geoError}</p>
            )}
          </div>
        )}
      </div>

      {/* Group status */}
      {members.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-foreground">Group Status</h3>
          {members.map((m) => (
            <Card key={m.user_id as string} className="border-border">
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {(m.display_name as string)?.charAt(0)?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-foreground">{m.display_name as string}</span>
                </div>
                {m.checked_in ? (
                  <CheckCircle2 className="h-5 w-5 text-secondary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/30" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
