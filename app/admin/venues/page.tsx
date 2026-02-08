"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Building2, MapPin, Check, X } from "lucide-react"
import { VENUE_STATUS_CONFIG } from "@/lib/config"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminVenuesPage() {
  const { data, isLoading, mutate } = useSWR("/api/admin/venues", fetcher)
  const [acting, setActing] = useState<string | null>(null)

  const venues = data?.venues || []
  const pending = venues.filter((v: Record<string, unknown>) => v.status === "pending")
  const all = venues

  const handleAction = async (venueId: string, status: string) => {
    setActing(venueId)
    await fetch(`/api/admin/venues/${venueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    mutate()
    setActing(null)
  }

  const VenueCard = ({ venue }: { venue: Record<string, unknown> }) => {
    const statusConfig = VENUE_STATUS_CONFIG[venue.status as string]
    return (
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{venue.name as string}</h3>
                {statusConfig && (
                  <Badge className={statusConfig.className} variant="secondary">
                    {statusConfig.label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{venue.address as string}, {venue.area as string}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Partner: {(venue.profiles as Record<string, unknown>)?.display_name as string || "Unknown"}
                {" · "}
                Capacity: {venue.max_capacity as number}
              </p>
            </div>
            {venue.status === "pending" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleAction(venue.id as string, "active")}
                  disabled={acting === venue.id}
                >
                  {acting === venue.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(venue.id as string, "inactive")}
                  disabled={acting === venue.id}
                  className="text-destructive hover:bg-destructive/5"
                >
                  <X className="mr-1 h-3 w-3" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Venues</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage partner venues and approvals</p>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {all.length === 0 ? (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No venues registered</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {all.map((v: Record<string, unknown>) => <VenueCard key={v.id as string} venue={v} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          {pending.length === 0 ? (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <Check className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No pending approvals</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((v: Record<string, unknown>) => <VenueCard key={v.id as string} venue={v} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
