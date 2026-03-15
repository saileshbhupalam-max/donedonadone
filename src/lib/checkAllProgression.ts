/**
 * @module checkAllProgression
 * @description Unified entry point for all progression checks (badges, milestones, ranks).
 * Fetches stats ONCE via progressionStats.ts and passes them to each system, eliminating
 * redundant Supabase queries that occurred when pages called badges/milestones/ranks separately.
 *
 * Key exports:
 * - ProgressionResult — Combined result of all progression checks
 * - checkAllProgression() — Single function that runs all progression checks with shared stats
 *
 * Dependencies: progressionStats.ts, badges.ts, growth.ts, ranks.ts, engagementScore.ts
 * Related: Home/index.tsx, Profile/index.tsx, GivePropsFlow.tsx (callers that check multiple systems)
 */

import { Tables } from "@/integrations/supabase/types";
import { fetchProgressionStats, clearProgressionCache } from "@/lib/progressionStats";
import type { ProgressionStats } from "@/lib/progressionStats";
import { checkAndAwardBadges } from "@/lib/badges";
import { checkMilestones, MilestoneDef } from "@/lib/growth";
import { computeEngagementScore, EngagementResult } from "@/lib/engagementScore";
import { getRankProgress, getRankForHours } from "@/lib/ranks";
import type { RankTier } from "@/lib/ranks";

type Profile = Tables<"profiles">;

// ─── Combined Result ────────────────────────────────────

export interface ProgressionResult {
  /** Newly awarded badge type strings (empty array if none) */
  newBadges: string[];

  /** Newly awarded milestone definition, or null if none */
  newMilestone: MilestoneDef | null;

  /** Current rank info derived from focus_hours */
  rank: {
    current: RankTier;
    next: RankTier | null;
    progress: number;
    hoursToNext: number;
  };

  /** Engagement score and churn risk */
  engagement: EngagementResult;

  /** The shared stats that were fetched — available for callers that need raw data */
  stats: ProgressionStats;
}

// ─── Main Entry Point ───────────────────────────────────

/**
 * Run all progression checks with a single shared stats fetch.
 * Call this instead of calling checkAndAwardBadges + checkMilestones + rank checks separately.
 *
 * @param userId - The user to check progression for
 * @param profile - The user's full profile row (needed by badges for profile_completion, socials, created_at)
 * @param options.skipBadges - Skip badge checking (default: false)
 * @param options.skipMilestones - Skip milestone checking (default: false)
 * @param options.clearCache - Force-clear cached stats before fetching (default: false)
 */
export async function checkAllProgression(
  userId: string,
  profile: Profile,
  options?: {
    skipBadges?: boolean;
    skipMilestones?: boolean;
    clearCache?: boolean;
  },
): Promise<ProgressionResult> {
  const { skipBadges = false, skipMilestones = false, clearCache = false } = options || {};

  // Clear cache if requested (e.g., after a write like addFocusHours)
  if (clearCache) {
    clearProgressionCache(userId);
  }

  // Single fetch for all systems
  const stats = await fetchProgressionStats(userId);

  // Run badge and milestone checks in parallel — both accept pre-fetched stats
  // so they skip their own independent Supabase queries
  const [newBadges, newMilestone] = await Promise.all([
    skipBadges ? [] : checkAndAwardBadges(userId, profile, stats),
    skipMilestones ? null : checkMilestones(userId, stats),
  ]);

  // Rank progress is pure computation from focus_hours — no DB call needed
  const focusHours = Number(stats.profile.focus_hours ?? 0);
  const rank = getRankProgress(focusHours);

  // Engagement score uses real 30-day scoped data from progressionStats.
  // Previously passed lifetime totals (eventGoingCount, uniquePropGivers) which
  // masked churn risk — a user active 6 months ago but idle now looked "healthy".
  const engagement = computeEngagementScore({
    sessionsLast30d: stats.sessionsLast30d,
    connectionsLast30d: stats.connectionsLast30d,
    streakDays: stats.profile.current_streak || 0,
    fcEarnedLast30d: stats.fcEarnedLast30d,
    contributionsLast30d: stats.contributionsLast30d,
  });

  return {
    newBadges,
    newMilestone,
    rank,
    engagement,
    stats,
  };
}
