"use client"

import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Check, ThumbsUp, ThumbsDown } from "lucide-react"
import { StarRating } from "./star-rating"
import { SessionHeader } from "./session-header"

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

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
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
        member_ratings: Object.entries(memberRatings).map(([to_user, would_cowork_again]) => ({
          to_user,
          would_cowork_again,
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

      {/* Member ratings */}
      {members.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-medium text-foreground">Would you cowork again with...</h4>
          {members.map((m) => (
            <Card key={m.user_id as string} className="border-border">
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {(m.display_name as string)?.charAt(0)?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-foreground">{m.display_name as string}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMemberRatings((prev) => ({ ...prev, [m.user_id as string]: true }))}
                    className={`rounded-lg border p-2 transition-colors ${
                      memberRatings[m.user_id as string] === true
                        ? "border-secondary bg-secondary/10 text-secondary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberRatings((prev) => ({ ...prev, [m.user_id as string]: false }))}
                    className={`rounded-lg border p-2 transition-colors ${
                      memberRatings[m.user_id as string] === false
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
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
