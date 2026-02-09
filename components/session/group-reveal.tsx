"use client"

import { useState } from "react"
import useSWR from "swr"
import { Loader2, MessageCircle, Navigation, Lock, Target, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GroupMemberCard } from "./group-member-card"
import { SessionHeader } from "./session-header"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface GroupRevealProps {
  sessionId: string
}

export function GroupReveal({ sessionId }: GroupRevealProps) {
  const { data, isLoading, error, mutate } = useSWR(`/api/session/${sessionId}/group`, fetcher)
  const [goalText, setGoalText] = useState("")
  const [addingGoal, setAddingGoal] = useState(false)

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
  const hasCheckedIn = data?.hasCheckedIn || false
  const goals: { id: string; user_id: string; goal_text: string; completed: boolean }[] = data?.goals || []

  const handleAddGoal = async () => {
    if (!goalText.trim()) return
    setAddingGoal(true)
    await fetch(`/api/sessions/${sessionId}/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal_text: goalText.trim() }),
    })
    setGoalText("")
    setAddingGoal(false)
    mutate()
  }

  const handleDeleteGoal = async (goalId: string) => {
    await fetch(`/api/sessions/${sessionId}/goals`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal_id: goalId }),
    })
    mutate()
  }

  // Group goals by user
  const goalsByUser: Record<string, typeof goals> = {}
  goals.forEach((g) => {
    if (!goalsByUser[g.user_id]) goalsByUser[g.user_id] = []
    goalsByUser[g.user_id].push(g)
  })

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

      {/* Information asymmetry notice */}
      {!hasCheckedIn && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <Lock className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            Full profiles unlock after check-in. You can see names and work vibes for now.
          </p>
        </div>
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
          const memberId = member.user_id as string
          const memberGoals = goalsByUser[memberId] || []
          return (
            <div key={memberId} className="flex flex-col gap-0">
              <GroupMemberCard
                name={profile?.display_name as string || "Unknown"}
                avatarUrl={profile?.avatar_url as string | null}
                workType={hasCheckedIn ? (profile?.work_type as string | null) : null}
                bio={hasCheckedIn ? (prefs?.bio as string | null) : null}
                workVibe={prefs?.work_vibe as string | null}
                noisePref={hasCheckedIn ? (prefs?.noise_preference as string | null) : null}
                commStyle={hasCheckedIn ? (prefs?.communication_style as string | null) : null}
                isLimited={!hasCheckedIn}
              />
              {/* Member goals */}
              {memberGoals.length > 0 && (
                <div className="mx-1 -mt-1 rounded-b-lg border border-t-0 border-border bg-muted/30 px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {memberGoals.map((g) => (
                      <Badge key={g.id} variant="outline" className="gap-1 text-xs">
                        <Target className="h-3 w-3" />
                        {g.goal_text}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Session Goals input */}
      <div className="flex flex-col gap-3">
        <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Target className="h-4 w-4 text-primary" />
          Your Session Goals
        </h4>
        <p className="text-xs text-muted-foreground">
          Set 1-3 goals for this session. Your group can see them for accountability.
        </p>
        {/* Existing goals */}
        {goalsByUser[data?.group?.group_members?.find(
          (m: Record<string, unknown>) => goals.some(g => g.user_id === m.user_id)
        )?.user_id || ""]?.length > 0 ? null : null}
        <div className="flex flex-col gap-1.5">
          {goals
            .filter((g) => members.some((m: Record<string, unknown>) => m.user_id === g.user_id))
            .filter((g) => {
              // Show current user's goals with delete button
              return true
            })
            .map(() => null) // handled above in member cards
          }
        </div>
        {/* Add goal form */}
        <div className="flex gap-2">
          <input
            type="text"
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddGoal()}
            placeholder="e.g., Finish pitch deck, Write 2000 words..."
            maxLength={200}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            size="sm"
            onClick={handleAddGoal}
            disabled={!goalText.trim() || addingGoal}
          >
            {addingGoal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        {/* Current user's goals list */}
        <div className="flex flex-wrap gap-2">
          {goals
            .filter((g) => !members.some((m: Record<string, unknown>) => (m.user_id as string) !== g.user_id))
            .map(() => null) // goals are shown on member cards
          }
        </div>
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
