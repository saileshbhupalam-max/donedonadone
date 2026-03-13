/**
 * @module aiGrowthNudges
 * @description Smart timing engine for growth nudges. Determines when and what
 * nudges to show users based on their activity, context, and cooldown periods.
 *
 * Key exports:
 * - shouldShowReferralNudge() — Boolean + config based on context triggers
 * - generateNudgeMessage() — Personalized message for a given nudge type
 * - getNeighborhoodGrowthStats() — Stats for "help us launch" nudges
 * - trackNudgeDismissal() — Record dismissal for cooldown calculation
 * - getNudgeCooldown() — When a nudge type can show again
 *
 * Dependencies: Supabase client, growthConfig
 * Tables: profiles, analytics_events (for nudge tracking)
 */
import { supabase } from "@/integrations/supabase/client";
import { getGrowthConfig } from "@/lib/growthConfig";

// ─── Types ──────────────────────────────────

export type NudgeType =
  | 'referral_post_session'
  | 'referral_milestone'
  | 'referral_no_slots'
  | 'referral_onboarding'
  | 'neighborhood_launch'
  | 'contribution_prompt'
  | 'streak_reminder';

export interface NudgeConfig {
  show: boolean;
  type: NudgeType;
  message: string;
  cta: string;
  priority: number; // Lower = higher priority
}

export interface NudgeContext {
  justFinishedSession?: boolean;
  sessionRating?: number;
  sessionCount?: number;
  noSlotsAvailable?: boolean;
  isOnboarding?: boolean;
  neighborhood?: string;
}

export interface NeighborhoodStats {
  name: string;
  currentMembers: number;
  threshold: number;
  percentToLaunch: number;
}

// ─── Cooldown Constants ──────────────────────────────

const NUDGE_COOLDOWNS: Record<NudgeType, number> = {
  referral_post_session: 3 * 24 * 60 * 60 * 1000,    // 3 days
  referral_milestone: 7 * 24 * 60 * 60 * 1000,        // 7 days
  referral_no_slots: 24 * 60 * 60 * 1000,             // 1 day
  referral_onboarding: 7 * 24 * 60 * 60 * 1000,       // 7 days
  neighborhood_launch: 3 * 24 * 60 * 60 * 1000,       // 3 days
  contribution_prompt: 2 * 24 * 60 * 60 * 1000,       // 2 days
  streak_reminder: 24 * 60 * 60 * 1000,               // 1 day
};

// ─── Cooldown Management ──────────────────────────────

const DISMISSAL_STORAGE_KEY = 'fc_nudge_dismissals';

function getDismissals(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DISMISSAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Track that a user dismissed a nudge. Uses localStorage for instant access
 * without async DB calls.
 */
export function trackNudgeDismissal(userId: string, nudgeType: NudgeType): void {
  const dismissals = getDismissals();
  dismissals[`${userId}:${nudgeType}`] = Date.now();
  localStorage.setItem(DISMISSAL_STORAGE_KEY, JSON.stringify(dismissals));

  // Also track in analytics (fire-and-forget)
  supabase.from('analytics_events').insert({
    event_type: 'nudge_dismissed',
    user_id: userId,
    metadata: { nudge_type: nudgeType },
  }).then(() => {});
}

/**
 * Get when a specific nudge type can be shown again.
 * Returns null if it can be shown now, or a Date when cooldown expires.
 */
export function getNudgeCooldown(userId: string, nudgeType: NudgeType): Date | null {
  const dismissals = getDismissals();
  const lastDismissed = dismissals[`${userId}:${nudgeType}`];
  if (!lastDismissed) return null;

  const cooldownMs = NUDGE_COOLDOWNS[nudgeType];
  const cooldownEnd = lastDismissed + cooldownMs;

  if (Date.now() >= cooldownEnd) return null;
  return new Date(cooldownEnd);
}

function isOnCooldown(userId: string, nudgeType: NudgeType): boolean {
  return getNudgeCooldown(userId, nudgeType) !== null;
}

// ─── Core Functions ──────────────────────────────────

/**
 * Determine if a referral nudge should be shown, and which one.
 * Checks multiple trigger conditions and returns the highest-priority match.
 */
export function shouldShowReferralNudge(
  userId: string,
  context: NudgeContext
): NudgeConfig | null {
  const config = getGrowthConfig();
  const candidates: NudgeConfig[] = [];

  // Post good session (4-5 star)
  if (
    config.growth.nudgeAfterGoodSession &&
    context.justFinishedSession &&
    context.sessionRating &&
    context.sessionRating >= 4 &&
    !isOnCooldown(userId, 'referral_post_session')
  ) {
    candidates.push({
      show: true,
      type: 'referral_post_session',
      message: 'Great session! Know someone who would love this?',
      cta: 'Invite a friend',
      priority: 1,
    });
  }

  // Session milestones (5, 10, 25)
  if (
    config.growth.nudgeAfterMilestone &&
    context.sessionCount &&
    [5, 10, 25].includes(context.sessionCount) &&
    !isOnCooldown(userId, 'referral_milestone')
  ) {
    candidates.push({
      show: true,
      type: 'referral_milestone',
      message: `${context.sessionCount} sessions! You are a FocusClub regular. Invite friends and earn credits.`,
      cta: 'Share your code',
      priority: 2,
    });
  }

  // No slots available
  if (
    config.growth.nudgeWhenNoSlots &&
    context.noSlotsAvailable &&
    !isOnCooldown(userId, 'referral_no_slots')
  ) {
    candidates.push({
      show: true,
      type: 'referral_no_slots',
      message: 'More members in your area means more session times. Help us grow!',
      cta: 'Invite friends',
      priority: 3,
    });
  }

  // Onboarding (before 2nd session)
  if (
    context.isOnboarding &&
    !isOnCooldown(userId, 'referral_onboarding')
  ) {
    candidates.push({
      show: true,
      type: 'referral_onboarding',
      message: 'Know someone who would enjoy coworking? Both of you get rewards!',
      cta: 'Send an invite',
      priority: 4,
    });
  }

  if (candidates.length === 0) return null;

  // Return highest priority (lowest number)
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0];
}

/**
 * Generate a personalized nudge message for a specific nudge type.
 */
export function generateNudgeMessage(
  userId: string,
  nudgeType: NudgeType,
  context: NudgeContext & { userName?: string; referralCode?: string }
): string {
  const config = getGrowthConfig();
  const name = context.userName || 'there';

  switch (nudgeType) {
    case 'referral_post_session':
      return `Hey ${name}, that was a great session! Share FocusClub with a friend and earn ${config.credits.referralComplete} Focus Credits when they complete their first session.`;

    case 'referral_milestone':
      return `${context.sessionCount} sessions and counting! You clearly love FocusClub. Each friend you refer earns you ${config.credits.referralComplete} FC. Your code: ${context.referralCode || 'check your profile'}`;

    case 'referral_no_slots':
      return `No sessions available at your preferred time? More members in your area means more options. Share your code and help us grow!`;

    case 'referral_onboarding':
      return `Welcome to FocusClub, ${name}! Coworking is better with friends. Invite someone and you both get rewarded.`;

    case 'neighborhood_launch':
      return `${context.neighborhood || 'Your neighborhood'} is close to launching! Share with locals to unlock sessions in your area.`;

    case 'contribution_prompt':
      return `Been to a great cafe lately? Share a photo or review and earn Focus Credits!`;

    case 'streak_reminder':
      return `Keep your streak alive! Attend a session this week to maintain your momentum.`;

    default:
      return '';
  }
}

/**
 * Get growth stats for a neighborhood (for "help us launch" nudges).
 */
export async function getNeighborhoodGrowthStats(
  neighborhood: string
): Promise<NeighborhoodStats> {
  const config = getGrowthConfig();
  const threshold = config.growth.neighborhoodLaunchThreshold;

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('neighborhood', neighborhood);

  const currentMembers = count || 0;

  return {
    name: neighborhood,
    currentMembers,
    threshold,
    percentToLaunch: Math.min(100, Math.round((currentMembers / threshold) * 100)),
  };
}
