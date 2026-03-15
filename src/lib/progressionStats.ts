/**
 * @module progressionStats
 * @description Shared stats fetcher for the 4 progression systems (badges, growth/milestones,
 * ranks, engagementScore). Gathers all data needed by all systems in a single parallel fetch,
 * with a 60-second TTL cache to prevent redundant queries when multiple systems check in sequence.
 *
 * Key exports:
 * - ProgressionStats — Interface containing all fields needed across badges, milestones, ranks, and engagement
 * - fetchProgressionStats() — Parallel-fetches all stats from Supabase, caches for 60s per userId
 * - clearProgressionCache() — Force-clear the cache (useful after writes like addFocusHours)
 *
 * Dependencies: Supabase client (queries profiles, peer_props, prompt_responses, prompts, event_rsvps, member_badges, member_milestones)
 * Tables: profiles, peer_props, prompt_responses, prompts, event_rsvps, member_badges, member_milestones
 * Related: badges.ts, growth.ts, ranks.ts, engagementScore.ts, checkAllProgression.ts
 */

import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

// ─── Shared Stats Interface ──────────────────────────────
// Union of all fields needed by badges.ts, growth.ts, ranks.ts, and engagementScore.ts

export interface ProgressionStats {
  // ── Profile fields (used by badges, growth, ranks) ──
  profile: Pick<Profile,
    "id" | "created_at" | "profile_completion" | "linkedin_url" | "instagram_handle" |
    "twitter_handle" | "events_attended" | "current_streak" | "focus_hours" | "focus_rank"
  >;

  // ── Badge system stats (badges.ts → BadgeCheckStats) ──
  promptAnswerCount: number;
  totalPromptCount: number;
  eventGoingCount: number;
  totalFiresReceived: number;
  maxSingleFireCount: number;
  referralCount: number;
  totalPropsReceived: number;
  energyPropsReceived: number;
  helpfulPropsReceived: number;
  focusedPropsReceived: number;
  uniquePropGivers: number;

  // ── Growth/milestone stats (growth.ts) ──
  propsGivenCount: number;

  // ── Already-earned tracking (avoids redundant re-checks) ──
  existingBadgeTypes: string[];
  existingMilestoneTypes: string[];
}

// ─── Cache ──────────────────────────────────────────────
// 60-second TTL cache keyed by userId to prevent redundant queries
// when badges, milestones, and ranks all check in the same page load

interface CacheEntry {
  stats: ProgressionStats;
  timestamp: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const cache = new Map<string, CacheEntry>();

export function clearProgressionCache(userId?: string): void {
  if (userId) {
    cache.delete(userId);
  } else {
    cache.clear();
  }
}

// ─── Fetch All Stats ────────────────────────────────────

export async function fetchProgressionStats(userId: string): Promise<ProgressionStats> {
  // Check cache first
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.stats;
  }

  // Parallel-fetch everything all 4 systems need
  const [
    profileRes,
    promptAnswersRes,
    totalPromptsRes,
    eventGoingRes,
    firesRes,
    referralRes,
    propsReceivedRes,
    propsGivenRes,
    existingBadgesRes,
    existingMilestonesRes,
  ] = await Promise.all([
    // Profile: used by badges (profile_completion, socials, created_at), growth (events_attended, current_streak, created_at), ranks (focus_hours)
    supabase.from("profiles")
      .select("id, created_at, profile_completion, linkedin_url, instagram_handle, twitter_handle, events_attended, current_streak, focus_hours, focus_rank")
      .eq("id", userId)
      .single(),

    // Prompt answers count: used by badges (first_prompt, prompt_streak_3, prompt_all) and growth (first_prompt_answer, prompts_5)
    supabase.from("prompt_responses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),

    // Total prompts count: used by badges (prompt_all check)
    supabase.from("prompts")
      .select("id", { count: "exact", head: true }),

    // Event RSVP count (going): used by badges (first_event, event_regular, event_og)
    supabase.from("event_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "going"),

    // Prompt fire counts: used by badges (fire_starter, community_voice)
    supabase.from("prompt_responses")
      .select("fire_count")
      .eq("user_id", userId),

    // Referral count: used by badges (recruiter) and growth (referral_1, referral_3, referral_10)
    supabase.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", userId),

    // Props received with type + giver: used by badges (first_props, energy_magnet, helper_badge, focus_idol, beloved)
    // and growth (first_prop_received, props_received_25, props_received_50)
    supabase.from("peer_props")
      .select("prop_type, from_user")
      .eq("to_user", userId),

    // Props given count: used by growth (first_prop_given)
    supabase.from("peer_props")
      .select("id", { count: "exact", head: true })
      .eq("from_user", userId),

    // Existing badges: used by badge check to skip already-earned
    supabase.from("member_badges")
      .select("badge_type")
      .eq("user_id", userId),

    // Existing milestones: used by milestone check to skip already-earned
    supabase.from("member_milestones")
      .select("milestone_type")
      .eq("user_id", userId),
  ]);

  // Derive prop stats from the raw props array
  const props = (propsReceivedRes.data || []) as { prop_type: string; from_user: string }[];
  const fireCounts = (firesRes.data || []).map((r) => r.fire_count || 0);

  const stats: ProgressionStats = {
    profile: profileRes.data ?? {
      id: userId,
      created_at: new Date().toISOString(),
      profile_completion: 0,
      linkedin_url: null,
      instagram_handle: null,
      twitter_handle: null,
      events_attended: 0,
      current_streak: 0,
      focus_hours: 0,
      focus_rank: "Newcomer",
    },

    // Badge stats
    promptAnswerCount: promptAnswersRes.count || 0,
    totalPromptCount: totalPromptsRes.count || 0,
    eventGoingCount: eventGoingRes.count || 0,
    totalFiresReceived: fireCounts.reduce((a, b) => a + b, 0),
    maxSingleFireCount: fireCounts.length > 0 ? Math.max(...fireCounts) : 0,
    referralCount: referralRes.count || 0,
    totalPropsReceived: props.length,
    energyPropsReceived: props.filter(p => p.prop_type === "energy").length,
    helpfulPropsReceived: props.filter(p => p.prop_type === "helpful").length,
    focusedPropsReceived: props.filter(p => p.prop_type === "focused").length,
    uniquePropGivers: new Set(props.map(p => p.from_user)).size,

    // Growth stats
    propsGivenCount: propsGivenRes.count || 0,

    // Already-earned tracking
    existingBadgeTypes: (existingBadgesRes.data || []).map(b => b.badge_type),
    existingMilestoneTypes: (existingMilestonesRes.data || []).map((m: any) => m.milestone_type),
  };

  // Store in cache
  cache.set(userId, { stats, timestamp: Date.now() });

  return stats;
}
