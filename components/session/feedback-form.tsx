"use client"

import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Check, ThumbsUp, ThumbsDown, Heart, Target } from "lucide-react"
import { StarRating } from "./star-rating"
import { SessionHeader } from "./session-header"
import { MEMBER_RATING_TAGS, VENUE_RATING_DIMENSIONS } from "@/lib/config"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const FEEDBACK_TAGS = [
  "Great vibe",
  "Productive",
  "Good group",
  "Nice venue",
  "Good coffee",
  "Too noisy",
  "Too quiet",
  "Poor wifi",
  "Late start",
  "Great host",
]

interface FeedbackFormProps {
  sessionId: string
}

export function FeedbackForm({ sessionId }: FeedbackFormProps) {
  const { data, isLoading } = useSWR(`/api/session/${sessionId}/feedback`, fetcher)
  const [rating, setRating] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState("")
  const [memberRatings, setMemberRatings] = useState<Record<string, boolean>>({})
  const [memberTags, setMemberTags] = useState<Record<string, string[]>>({})
  const [memberEnergy, setMemberEnergy] = useState<Record<string, number>>({})
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [venueRatings, setVenueRatings] = useState<Record<string, number>>({})
  const [goalCompletions, setGoalCompletions] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

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

  if (data?.existing || submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary/10">
          <Check className="h-10 w-10 text-secondary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Thanks for your feedback!</h3>
        <p className="text-sm text-muted-foreground">Your rating helps us improve sessions.</p>
      </div>
    )
  }

  const members: Record<string, unknown>[] = data?.members || []
  const session = data?.session
  const venue = session?.venues
  const goals: { id: string; goal_text: string; completed: boolean }[] = data?.goals || []

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
  }

  const toggleMemberTag = (userId: string, tag: string) => {
    setMemberTags((prev) => {
      const current = prev[userId] || []
      return {
        ...prev,
        [userId]: current.includes(tag)
          ? current.filter((t) => t !== tag)
          : [...current, tag],
      }
    })
  }

  const handleSubmit = async () => {
    if (rating === 0) return
    setSubmitting(true)

    await fetch(`/api/session/${sessionId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        overall_rating: rating,
        tags,
        comment: comment || null,
        venue_ratings: venueRatings,
        member_ratings: Object.entries(memberRatings).map(([to_user, would_cowork_again]) => ({
          to_user,
          would_cowork_again,
          tags: memberTags[to_user] || [],
          energy_match: memberEnergy[to_user] || null,
        })),
        favorites: Object.entries(favorites)
          .filter(([, isFav]) => isFav)
          .map(([userId]) => userId),
        goal_completions: Object.entries(goalCompletions).map(([goalId, completed]) => ({
          goal_id: goalId,
          completed,
        })),
      }),
    })

    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Session header */}
      {session && venue && (
        <SessionHeader
          venueName={venue.name}
          date={session.date}
          startTime={session.start_time}
          endTime={session.end_time}
        />
      )}

      {/* Goal completion */}
      {goals.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Target className="h-4 w-4 text-primary" />
            Did you complete your goals?
          </h4>
          {goals.map((goal) => (
            <label
              key={goal.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={goalCompletions[goal.id] ?? goal.completed}
                onChange={(e) => setGoalCompletions((prev) => ({ ...prev, [goal.id]: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-primary"
              />
              <span className="text-sm text-foreground">{goal.goal_text}</span>
            </label>
          ))}
        </div>
      )}

      {/* Overall rating */}
      <div className="flex flex-col items-center gap-3">
        <h3 className="text-lg font-semibold text-foreground">How was your session?</h3>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-medium text-foreground">What stood out?</h4>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                tags.includes(tag)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Venue ratings */}
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-medium text-foreground">Rate the venue</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {VENUE_RATING_DIMENSIONS.map((dim) => (
            <div key={dim.key} className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm text-foreground">{dim.label}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVenueRatings((prev) => ({ ...prev, [dim.key]: v }))}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                      (venueRatings[dim.key] || 0) >= v
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Member ratings */}
      {members.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-medium text-foreground">Rate your group members</h4>
          {members.map((m) => {
            const userId = m.user_id as string
            return (
              <Card key={userId} className="border-border">
                <CardContent className="flex flex-col gap-3 p-3">
                  {/* Name + cowork again */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {(m.display_name as string)?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground">{m.display_name as string}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMemberRatings((prev) => ({ ...prev, [userId]: true }))}
                        className={`rounded-lg border p-2 transition-colors ${
                          memberRatings[userId] === true
                            ? "border-secondary bg-secondary/10 text-secondary"
                            : "border-border text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemberRatings((prev) => ({ ...prev, [userId]: false }))}
                        className={`rounded-lg border p-2 transition-colors ${
                          memberRatings[userId] === false
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : "border-border text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </button>
                      {/* Favorite button */}
                      <button
                        type="button"
                        onClick={() => setFavorites((prev) => ({ ...prev, [userId]: !prev[userId] }))}
                        className={`rounded-lg border p-2 transition-colors ${
                          favorites[userId]
                            ? "border-pink-400 bg-pink-50 text-pink-500"
                            : "border-border text-muted-foreground hover:bg-accent"
                        }`}
                        title="Add to favorites"
                      >
                        <Heart className={`h-4 w-4 ${favorites[userId] ? "fill-current" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Energy match slider */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Energy match:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setMemberEnergy((prev) => ({ ...prev, [userId]: v }))}
                          className={`flex h-6 w-6 items-center justify-center rounded text-xs transition-colors ${
                            (memberEnergy[userId] || 0) >= v
                              ? "bg-amber-400 text-white"
                              : "bg-muted text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Member tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {MEMBER_RATING_TAGS.map((tag) => (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => toggleMemberTag(userId, tag.value)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                          (memberTags[userId] || []).includes(tag.value)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Comment */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-foreground">Anything else?</h4>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional feedback..."
          className="min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Submit */}
      <Button onClick={handleSubmit} disabled={rating === 0 || submitting} className="w-full">
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Submit Feedback
      </Button>
    </div>
  )
}
