"use client"

import useSWR from "swr"
import { Loader2, MessageCircle, Navigation } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GroupMemberCard } from "./group-member-card"
import { SessionHeader } from "./session-header"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface GroupRevealProps {
  sessionId: string
}

export function GroupReveal({ sessionId }: GroupRevealProps) {
  const { data, isLoading, error } = useSWR(`/api/session/${sessionId}/group`, fetcher)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || data?.error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">
          {data?.error || "Failed to load group details"}
        </p>
      </div>
    )
  }

  const group = data?.group
  const session = data?.session
  const venue = session?.venues
  const members = group?.group_members || []

  return (
    <div className="flex flex-col gap-6">
      {/* Session header */}
      {session && venue && (
        <SessionHeader
          venueName={venue.name}
          venueAddress={`${venue.address}, ${venue.area}`}
          date={session.date}
          startTime={session.start_time}
          endTime={session.end_time}
          lat={venue.lat}
          lng={venue.lng}
        />
      )}

      {/* Group info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Your Group</h3>
          {group?.table_assignment && (
            <p className="text-sm text-muted-foreground">Table: {group.table_assignment}</p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{members.length} members</p>
      </div>

      {/* Members */}
      <div className="grid gap-4 sm:grid-cols-2">
        {members.map((member: Record<string, unknown>) => {
          const profile = member.profiles as Record<string, unknown> | null
          const prefs = member.coworker_preferences as Record<string, unknown> | null
          return (
            <GroupMemberCard
              key={member.user_id as string}
              name={profile?.display_name as string || "Unknown"}
              avatarUrl={profile?.avatar_url as string | null}
              workType={profile?.work_type as string | null}
              bio={prefs?.bio as string | null}
              workVibe={prefs?.work_vibe as string | null}
              noisePref={prefs?.noise_preference as string | null}
              commStyle={prefs?.communication_style as string | null}
            />
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button className="flex-1" disabled>
          <MessageCircle className="mr-2 h-4 w-4" />
          WhatsApp Group (Coming Soon)
        </Button>
        {venue?.lat && venue?.lng && (
          <Button variant="outline" className="flex-1" asChild>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation className="mr-2 h-4 w-4" />
              Get Directions
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}
