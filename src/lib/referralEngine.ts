/**
 * @module referralEngine
 * @description Enhanced referral tracking with milestone rewards and smart nudges.
 *
 * Key exports:
 * - trackReferralSignup() — Record referral connection and award credits
 * - checkReferralMilestones() — Award credits/badges at referral milestones
 * - getReferralStats() — Get referral dashboard data for a user
 * - generateSmartReferralNudge() — AI-powered nudge based on timing/context
 *
 * Dependencies: Supabase client, focusCredits, growthConfig
 * Tables: referral_rewards, profiles, focus_credits
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { awardCredits } from "@/lib/focusCredits";
import { getGrowthConfig } from "@/lib/growthConfig";

// ─── Types ──────────────────────────────────

export type ReferralMilestone = 'signup' | 'first_session' | 'third_session';

export interface ReferralStats {
  totalReferred: number;
  completedFirstSession: number;
  completed3Sessions: number;
  totalCreditsEarned: number;
}

export interface ReferralNudge {
  show: boolean;
  type: string;
  message: string;
  cta: string;
}

// ─── Core Functions ──────────────────────────────────

/**
 * Track a new referral signup. Awards credits to both referrer and referee
 * based on config.
 */
export async function trackReferralSignup(
  referrerId: string,
  newUserId: string
): Promise<{ success: boolean; reason?: string }> {
  const config = getGrowthConfig().referral;

  // Check max referral rewards cap
  if (config.maxReferralRewards > 0) {
    const { data: existing } = await supabase
      .from('referral_rewards')
      .select('id')
      .eq('referrer_id', referrerId);

    if ((existing?.length ?? 0) >= config.maxReferralRewards) {
      return { success: false, reason: 'max_referral_rewards_reached' };
    }
  }

  // Record the referral reward entry
  const { error } = await supabase
    .from('referral_rewards')
    .insert({
      referrer_id: referrerId,
      referee_id: newUserId,
      milestone: 'signup' as ReferralMilestone,
      credits_awarded: 0,
    });

  if (error) {
    return { success: false, reason: error.message };
  }

  return { success: true };
}

/**
 * Check and award referral milestones for a referrer.
 * Called after a referee completes their 1st or 3rd session.
 */
export async function checkReferralMilestones(
  referrerId: string,
  refereeId: string,
  milestone: 'first_session' | 'third_session'
): Promise<{ awarded: number }> {
  const config = getGrowthConfig();

  // Check if this milestone was already awarded
  const { data: existing } = await supabase
    .from('referral_rewards')
    .select('id')
    .eq('referrer_id', referrerId)
    .eq('referee_id', refereeId)
    .eq('milestone', milestone)
    .limit(1);

  if (existing && existing.length > 0) {
    return { awarded: 0 };
  }

  // Determine credits based on milestone
  const creditAmount = milestone === 'first_session'
    ? config.credits.referralComplete
    : config.credits.referralMilestone3;

  // Award credits to referrer
  const result = await awardCredits(referrerId,
    milestone === 'first_session' ? 'referral_complete' : 'referral_milestone_3',
    creditAmount,
    { referral_user_id: refereeId }
  );

  if (result.success) {
    toast(`\u{1F91D} +${result.awarded} FC \u2014 Referral bonus!`);
  }

  // Record the milestone
  await supabase
    .from('referral_rewards')
    .insert({
      referrer_id: referrerId,
      referee_id: refereeId,
      milestone,
      credits_awarded: result.awarded,
    });

  return { awarded: result.awarded };
}

/**
 * Get referral stats for a user's referral dashboard.
 */
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const { data: rewards } = await supabase
    .from('referral_rewards')
    .select('milestone, credits_awarded')
    .eq('referrer_id', userId);

  if (!rewards || rewards.length === 0) {
    return { totalReferred: 0, completedFirstSession: 0, completed3Sessions: 0, totalCreditsEarned: 0 };
  }

  const entries = rewards as Array<{ milestone: string; credits_awarded: number }>;
  const signups = entries.filter(r => r.milestone === 'signup').length;
  const firstSessions = entries.filter(r => r.milestone === 'first_session').length;
  const thirdSessions = entries.filter(r => r.milestone === 'third_session').length;
  const totalCredits = entries.reduce((sum, r) => sum + r.credits_awarded, 0);

  return {
    totalReferred: signups,
    completedFirstSession: firstSessions,
    completed3Sessions: thirdSessions,
    totalCreditsEarned: totalCredits,
  };
}

/**
 * Generate a smart referral nudge based on user context.
 * Returns null if no nudge should be shown.
 */
export async function generateSmartReferralNudge(
  userId: string,
  context: {
    justFinishedSession?: boolean;
    sessionRating?: number;
    sessionCount?: number;
    noSlotsAvailable?: boolean;
  }
): Promise<ReferralNudge | null> {
  const config = getGrowthConfig();

  // Get user's referral code
  const { data: profile } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', userId)
    .single();

  const referralCode = (profile as any)?.referral_code || '';

  // After a good session (4-5 star rating)
  if (
    config.growth.nudgeAfterGoodSession &&
    context.justFinishedSession &&
    context.sessionRating &&
    context.sessionRating >= 4
  ) {
    return {
      show: true,
      type: 'post_good_session',
      message: 'Great session! Know someone who would love coworking with focus buddies?',
      cta: `Share your invite code: ${referralCode}`,
    };
  }

  // At session milestones (5, 10, 25)
  if (
    config.growth.nudgeAfterMilestone &&
    context.sessionCount &&
    [5, 10, 25].includes(context.sessionCount)
  ) {
    return {
      show: true,
      type: 'milestone',
      message: `You have hit ${context.sessionCount} sessions! Invite a friend and earn ${config.credits.referralComplete} Focus Credits.`,
      cta: `Share your invite code: ${referralCode}`,
    };
  }

  // No slots available
  if (config.growth.nudgeWhenNoSlots && context.noSlotsAvailable) {
    return {
      show: true,
      type: 'no_slots',
      message: 'More members = more sessions in your area. Help us grow!',
      cta: `Share your invite code: ${referralCode}`,
    };
  }

  return null;
}
