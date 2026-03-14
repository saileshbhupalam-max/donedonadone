/**
 * @module NextMilestone
 * @description Compact "next milestone" progression indicator for the home page.
 * Shows the closest achievable badge, milestone, or rank-up with progress.
 * Uses only data already available from the profile object (no extra API calls).
 *
 * Key exports:
 * - NextMilestoneIndicator — Single-line card showing next goal + progress
 *
 * Dependencies: profile data from useAuth(), badge definitions from badges.ts,
 *   milestone definitions from growth.ts, rank system from ranks.ts
 * Related: PrimaryActionCard.tsx (sits below it), Profile/index.tsx (has rank display)
 */
import { useMemo } from "react";
import { Tables } from "@/integrations/supabase/types";
import { getRankForHours, getNextRank, getRankProgress } from "@/lib/ranks";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

type Profile = Tables<"profiles">;

interface NextGoal {
  emoji: string;
  label: string;
  /** e.g. "attend 2 more sessions" or "7/10 sessions" */
  progress: string;
  /** 0-100 progress percentage */
  percent: number;
  /** Where tapping the indicator navigates */
  link?: string;
}

/**
 * Compute the single closest-to-achievement goal from profile data.
 * Priority: whatever has the highest completion percentage (closest to done).
 * This avoids showing a goal that's far away when a closer one exists.
 *
 * WHY pure function: keeps the component thin and testable without Supabase mocks.
 */
function computeNextGoal(profile: Profile): NextGoal | null {
  const attended = profile.events_attended || 0;
  const streak = profile.current_streak || 0;
  const focusHours = Number(profile.focus_hours ?? 0);
  const completion = profile.profile_completion || 0;
  const hasLinkedin = !!profile.linkedin_url;
  const hasInstagram = !!profile.instagram_handle;
  const hasTwitter = !!profile.twitter_handle;
  const isCaptain = profile.is_table_captain || false;

  const candidates: NextGoal[] = [];

  // ─── Event attendance milestones ───
  const eventThresholds = [
    { count: 1, emoji: "\uD83C\uDF89", label: "First Session" },
    { count: 3, emoji: "\uD83C\uDFAF", label: "Committed" },
    { count: 5, emoji: "\u2B50", label: "High Five" },
    { count: 10, emoji: "\uD83C\uDFC6", label: "Double Digits" },
    { count: 25, emoji: "\uD83D\uDC8E", label: "Quarter Century" },
    { count: 50, emoji: "\uD83D\uDC51", label: "Hall of Fame" },
  ];
  for (const t of eventThresholds) {
    if (attended < t.count) {
      const remaining = t.count - attended;
      candidates.push({
        emoji: t.emoji,
        label: t.label,
        progress: remaining === 1 ? "1 more session" : `${remaining} more sessions`,
        percent: Math.round((attended / t.count) * 100),
        link: "/events",
      });
      break; // Only the next threshold matters
    }
  }

  // ─── Rank progression ───
  const nextRank = getNextRank(focusHours);
  if (nextRank) {
    const rankProg = getRankProgress(focusHours);
    candidates.push({
      emoji: nextRank.emoji,
      label: nextRank.name,
      progress: `${rankProg.hoursToNext}h to go`,
      percent: rankProg.progress,
      link: "/me",
    });
  }

  // ─── Streak milestones ───
  const streakThresholds = [
    { count: 3, emoji: "\uD83D\uDD25", label: "On Fire" },
    { count: 5, emoji: "\uD83D\uDD25", label: "Unstoppable" },
    { count: 10, emoji: "\uD83D\uDD25", label: "Legendary Streak" },
  ];
  for (const t of streakThresholds) {
    if (streak < t.count && streak > 0) {
      const remaining = t.count - streak;
      candidates.push({
        emoji: t.emoji,
        label: t.label,
        progress: remaining === 1 ? "1 more week" : `${remaining} more weeks`,
        percent: Math.round((streak / t.count) * 100),
        link: "/events",
      });
      break;
    }
  }

  // ─── Profile completion ───
  if (completion < 100) {
    candidates.push({
      emoji: "\u2705",
      label: "Complete Profile",
      progress: `${completion}% done`,
      percent: completion,
      link: "/me",
    });
  }

  // ─── Social connector badge ───
  const socialCount = [hasLinkedin, hasInstagram, hasTwitter].filter(Boolean).length;
  if (socialCount < 3) {
    const remaining = 3 - socialCount;
    candidates.push({
      emoji: "\uD83D\uDD17",
      label: "Connector",
      progress: remaining === 1 ? "add 1 more social" : `add ${remaining} socials`,
      percent: Math.round((socialCount / 3) * 100),
      link: "/me",
    });
  }

  // ─── Table Captain eligibility — requires 10+ sessions ───
  if (!isCaptain && attended >= 5 && attended < 10) {
    candidates.push({
      emoji: "\uD83C\uDF96\uFE0F",
      label: "Table Captain eligible",
      progress: `${10 - attended} more sessions`,
      percent: Math.round((attended / 10) * 100),
      link: "/events",
    });
  }

  if (candidates.length === 0) return null;

  // Pick the candidate with the highest percent — closest to completion feels most motivating
  candidates.sort((a, b) => b.percent - a.percent);

  // But if the top candidate is already very close (>90%), prefer it strongly.
  // Otherwise, filter out anything below 10% (too far away to be motivating).
  const motivating = candidates.filter(c => c.percent >= 10);
  return motivating.length > 0 ? motivating[0] : candidates[0];
}

interface NextMilestoneIndicatorProps {
  profile: Profile;
}

export function NextMilestoneIndicator({ profile }: NextMilestoneIndicatorProps) {
  const navigate = useNavigate();
  const goal = useMemo(() => computeNextGoal(profile), [profile]);

  // Don't render if there's nothing to show (e.g. user maxed everything)
  if (!goal) return null;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/50 cursor-pointer hover:bg-muted/80 transition-colors"
      onClick={() => goal.link && navigate(goal.link)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" && goal.link) navigate(goal.link); }}
      aria-label={`Next milestone: ${goal.label} — ${goal.progress}`}
    >
      <span className="text-lg shrink-0" aria-hidden="true">{goal.emoji}</span>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs text-foreground leading-tight">
          <span className="text-muted-foreground">Next: </span>
          <span className="font-medium">{goal.label}</span>
          <span className="text-muted-foreground"> — {goal.progress}</span>
        </p>
        <Progress value={goal.percent} className="h-1.5" />
      </div>
    </div>
  );
}
