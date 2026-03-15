import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface QuickFeedbackProps {
  eventId: string;
  onDetailedFeedback: () => void;
}

const RATING_EMOJIS = [
  { value: 1, emoji: "\u{1F614}", label: "Meh" },
  { value: 2, emoji: "\u{1F610}", label: "Okay" },
  { value: 3, emoji: "\u{1F642}", label: "Good" },
  { value: 4, emoji: "\u{1F60A}", label: "Great" },
  { value: 5, emoji: "\u{1F929}", label: "Amazing" },
];

export function QuickFeedback({ eventId, onDetailedFeedback }: QuickFeedbackProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || selected === null) return;
    setSubmitting(true);
    try {
      await supabase.from("event_feedback").upsert({
        event_id: eventId,
        user_id: user.id,
        rating: selected,
        feedback_type: "quick",
      }, { onConflict: "event_id,user_id" });
      setSubmitted(true);
      toast.success("Thanks for the feedback!");

      // ── Gamification v2 Pipeline ──────────────────────────────────
      // All FC rewards are fire-and-forget so they never block the feedback UI.
      // Each mechanism targets a different behavioral psychology lever — see
      // WHY comments inline. If any single reward fails, the rest still run.
      runGamificationPipeline(user.id, eventId, selected).catch(console.error);
    } catch {
      toast.error("Couldn't save feedback. Try again?");
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Run the full FC gamification pipeline after session feedback is saved.
   * Fire-and-forget — errors are logged but never surface to the user or
   * block the feedback UI. Each step is wrapped individually so a failure
   * in step 2 doesn't prevent steps 3-6 from running.
   */
  const runGamificationPipeline = async (
    userId: string,
    sessionEventId: string,
    rating: number
  ) => {
    const { awardWithMultipliers, rollVariableReward, awardFirstSessionBonus,
            checkStreakMilestone, checkVenueVarietyBonus, checkAndAwardStreak,
            awardGroupChemistryBonus, getLifetimeEarnings } = await import("@/lib/focusCredits");
    const { getGrowthConfig } = await import("@/lib/growthConfig");

    const config = getGrowthConfig().credits;
    const lifetimeFC = await getLifetimeEarnings(userId);

    // Fetch streak weeks from profile — drives both the multiplier calc and
    // milestone checks. Defaults to 0 so new users still earn base FC.
    const { data: prof } = await supabase.from("profiles")
      .select("current_streak").eq("id", userId).single();
    const streakWeeks = prof?.current_streak || 0;

    // Fetch venue_id from the event so FC metadata links to the actual venue.
    // Used for venue variety tracking and session-level audit trails.
    const { data: eventData } = await supabase.from("events")
      .select("venue_id").eq("id", sessionEventId).single();
    const venueId = eventData?.venue_id || undefined;

    // ── 1. Session Complete FC (with tier + streak multipliers) ──────
    // WHY: The core earn loop. Tier multipliers (Starbucks model) reward
    // loyalty without gating access. Streak multipliers (Duolingo model)
    // exploit the endowment effect — the longer your streak, the more
    // painful it would be to lose it, so you keep coming back.
    const sessionResult = await awardWithMultipliers(
      userId, 'session_complete', config.sessionComplete,
      lifetimeFC, streakWeeks,
      { session_id: sessionEventId, venue_id: venueId }
    ).catch((e: unknown) => { console.error('[gamification] session_complete failed:', e); return null; });

    // ── 2. Mystery Double (variable ratio schedule) ──────────────────
    // WHY: Skinner's variable-ratio schedule is the most extinction-resistant
    // reinforcement pattern. A 10% chance of doubling FC creates the same
    // "maybe this time" anticipation that makes slot machines compelling —
    // but tied to real productive behavior, not chance alone.
    if (sessionResult?.success && sessionResult.awarded > 0) {
      await rollVariableReward(userId, sessionResult.awarded, sessionEventId)
        .catch((e: unknown) => console.error('[gamification] mystery_double failed:', e));
    }

    // ── 3. First Session Bonus (endowed progress) ────────────────────
    // WHY: Nunes & Dreze car wash study — customers given a loyalty card
    // with 2/10 stamps pre-filled completed at 2x the rate of those given
    // a blank 8-stamp card. The first-session bonus makes new users feel
    // they've already "started" their FC journey.
    await awardFirstSessionBonus(userId)
      .catch((e: unknown) => console.error('[gamification] first_session_bonus failed:', e));

    // ── 4. Streak Milestone Check (escalating commitment) ────────────
    // WHY: Milestone bonuses at 4/8/12/26/52 weeks exploit the "goal
    // gradient effect" — people accelerate effort as they approach a goal.
    // Each milestone is a new finish line that refreshes motivation.
    await checkStreakMilestone(userId, streakWeeks)
      .catch((e: unknown) => console.error('[gamification] streak_milestone failed:', e));

    // ── 5. Venue Variety Bonus (exploration incentive) ───────────────
    // WHY: Peloton data shows cross-discipline engagement reduces churn 60%.
    // Rewarding 3+ unique venues/month prevents "home base" stagnation and
    // drives discovery of new venues — which in turn feeds the supply side.
    await checkVenueVarietyBonus(userId)
      .catch((e: unknown) => console.error('[gamification] venue_variety failed:', e));

    // ── 6. Monthly Streak Bonus (habit formation) ────────────────────
    // WHY: 5+ sessions/month = the user has formed a weekly habit.
    // Rewarding this threshold reinforces the behavior right at the point
    // where it transitions from conscious effort to automatic routine.
    await checkAndAwardStreak(userId)
      .catch((e: unknown) => console.error('[gamification] streak_check failed:', e));

    // ── 7. Group Chemistry Bonus (social reinforcement) ──────────────
    // WHY: Habitica data shows small-group accountability increases task
    // completion 65%. When ALL attendees rate 4+ stars, everyone gets a
    // bonus — this creates a shared reward that strengthens group identity
    // and makes users want to be "the kind of person who makes groups great."
    if (rating >= 4) {
      const { data: allFeedback } = await supabase
        .from("event_feedback")
        .select("rating")
        .eq("event_id", sessionEventId);
      const { data: attendees } = await supabase
        .from("event_rsvps")
        .select("user_id")
        .eq("event_id", sessionEventId)
        .eq("status", "going");

      // Only trigger if every attendee has submitted feedback AND all rated 4+.
      // This avoids premature triggering when some members haven't rated yet.
      if (allFeedback && attendees && allFeedback.length >= attendees.length) {
        const allHighRated = allFeedback.every(f => f.rating >= 4);
        if (allHighRated) {
          await awardGroupChemistryBonus(userId, sessionEventId)
            .catch((e: unknown) => console.error('[gamification] group_chemistry failed:', e));
        }
      }
    }
  };

  if (submitted) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-2xl">{"\u{2728}"}</p>
          <p className="font-serif text-lg text-foreground">You're all set</p>
          <p className="text-sm text-muted-foreground">Your feedback shapes future sessions.</p>
          <Button onClick={() => navigate("/events")} className="w-full">
            Back to Sessions
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-4">
        <div className="text-center space-y-1">
          <p className="font-serif text-base text-foreground">How was your session?</p>
          <p className="text-xs text-muted-foreground">Quick rate — tap and go</p>
        </div>

        <div className="flex justify-center gap-3">
          {RATING_EMOJIS.map((r) => (
            <button
              key={r.value}
              onClick={() => setSelected(r.value)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                selected === r.value
                  ? "bg-primary/10 scale-110 ring-2 ring-primary/30"
                  : "hover:bg-muted"
              }`}
            >
              <span className="text-2xl">{r.emoji}</span>
              <span className="text-[10px] text-muted-foreground">{r.label}</span>
            </button>
          ))}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={selected === null || submitting}
          className="w-full"
          size="sm"
        >
          {submitting ? "Saving..." : "Done"}
        </Button>

        <button
          onClick={onDetailedFeedback}
          className="block w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Give detailed feedback instead
        </button>
      </CardContent>
    </Card>
  );
}
