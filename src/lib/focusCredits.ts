/**
 * @module focusCredits
 * @description Event-sourced Focus Credits engine. Every credit transaction is a ledger entry
 * in the focus_credits table. Enforces daily caps, diminishing returns, and quality gates.
 *
 * Key exports:
 * - awardCredits() — Create earning ledger entry with cap/diminishing enforcement
 * - spendCredits() — Deduct credits, returns success/failure
 * - getBalance() — Current balance from ledger sum
 * - getTodayEarnings() — Today's total earnings (for daily cap display)
 * - getDiminishingAmount() — Calculate actual FC after diminishing returns
 * - checkAndAwardStreak() — Award streak bonus if 5+ sessions this month
 *
 * Dependencies: Supabase client, growthConfig
 * Tables: focus_credits (ledger), profiles (session counts)
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getGrowthConfig } from "@/lib/growthConfig";

// ─── Types ──────────────────────────────────

export type CreditAction =
  | 'session_complete'
  | 'rate_group'
  | 'rate_venue'
  | 'write_review'
  | 'upload_photo'
  | 'report_venue_info'
  | 'referral_complete'
  | 'referral_milestone_3'
  | 'streak_bonus'
  | 'great_groupmate'
  | 'add_new_venue'
  | 'verify_venue_info'
  | 'check_in_photo'
  | 'report_company_presence'
  | 'report_seating_capacity'
  | 'report_floor_count'
  | 'report_amenities'
  | 'redeem_free_session'
  | 'redeem_priority_matching'
  | 'redeem_venue_upgrade'
  | 'redeem_pick_seat'
  | 'redeem_gift_session'
  | 'redeem_exclusive_session'
  | 'comeback_bonus'
  | 'taste_answer';

export interface CreditMetadata {
  venue_id?: string;
  session_id?: string;
  referral_user_id?: string;
  review_length?: number;
  photo_size_kb?: number;
  [key: string]: unknown;
}

export interface CreditEntry {
  id: string;
  user_id: string;
  amount: number;
  action: string;
  metadata: CreditMetadata;
  expires_at: string | null;
  created_at: string;
}

export interface AwardResult {
  success: boolean;
  awarded: number;
  reason?: string;
}

// ─── Helpers ──────────────────────────────────

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Actions that count toward daily earning cap (not referral/streak bonuses)
const CONTRIBUTION_ACTIONS: ReadonlySet<string> = new Set([
  'write_review', 'upload_photo', 'report_venue_info', 'verify_venue_info',
  'check_in_photo', 'report_company_presence', 'report_seating_capacity',
  'report_floor_count', 'report_amenities', 'add_new_venue',
]);

// ─── Core Functions ──────────────────────────────────

/**
 * Get the user's current Focus Credits balance (sum of all ledger entries,
 * excluding expired bonus credits).
 */
export async function getBalance(userId: string): Promise<number> {
  const now = new Date().toISOString();

  // Sum non-expired entries
  const { data, error } = await supabase
    .from('focus_credits')
    .select('amount, expires_at')
    .eq('user_id', userId);

  if (error || !data) return 0;

  return (data as Array<{ amount: number; expires_at: string | null }>).reduce(
    (sum, entry) => {
      // Skip expired bonus credits
      if (entry.expires_at && entry.expires_at < now) return sum;
      return sum + entry.amount;
    },
    0
  );
}

/**
 * Get total earnings for today (used for daily cap enforcement and display).
 */
export async function getTodayEarnings(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('focus_credits')
    .select('amount')
    .eq('user_id', userId)
    .gt('amount', 0)
    .gte('created_at', todayStart());

  if (error || !data) return 0;

  return (data as Array<{ amount: number }>).reduce(
    (sum, entry) => sum + entry.amount,
    0
  );
}

/**
 * Calculate the actual FC amount after diminishing returns for a given action
 * at a specific venue.
 */
export async function getDiminishingAmount(
  userId: string,
  action: CreditAction,
  venueId: string | null,
  baseAmount: number
): Promise<number> {
  const config = getGrowthConfig().credits;

  // Check daily action caps for reviews and photos
  if (action === 'write_review') {
    const { data: todayReviews } = await supabase
      .from('focus_credits')
      .select('id')
      .eq('user_id', userId)
      .eq('action', 'write_review')
      .gte('created_at', todayStart());

    if ((todayReviews?.length ?? 0) >= config.diminishingReturns.reviewsPerDay) {
      return 0;
    }

    // Same-venue review cap
    if (venueId) {
      const { data: venueReviews } = await supabase
        .from('focus_credits')
        .select('id')
        .eq('user_id', userId)
        .eq('action', 'write_review')
        .contains('metadata', { venue_id: venueId } as any);

      if ((venueReviews?.length ?? 0) >= config.diminishingReturns.sameVenueReviewCap) {
        return 0;
      }
    }
  }

  if (action === 'upload_photo' || action === 'check_in_photo') {
    const { data: todayPhotos } = await supabase
      .from('focus_credits')
      .select('id')
      .eq('user_id', userId)
      .in('action', ['upload_photo', 'check_in_photo'])
      .gte('created_at', todayStart());

    if ((todayPhotos?.length ?? 0) >= config.diminishingReturns.photosPerDay) {
      return 0;
    }

    // Same-venue photo cap
    if (venueId) {
      const { data: venuePhotos } = await supabase
        .from('focus_credits')
        .select('id')
        .eq('user_id', userId)
        .in('action', ['upload_photo', 'check_in_photo'])
        .contains('metadata', { venue_id: venueId } as any);

      if ((venuePhotos?.length ?? 0) >= config.diminishingReturns.sameVenuePhotoCap) {
        return 0;
      }
    }
  }

  return baseAmount;
}

/**
 * Award Focus Credits to a user. Creates a ledger entry after enforcing
 * daily cap and diminishing returns.
 */
export async function awardCredits(
  userId: string,
  action: CreditAction,
  amount: number,
  metadata: CreditMetadata = {}
): Promise<AwardResult> {
  const config = getGrowthConfig().credits;

  // Enforce daily earning cap for contribution actions
  if (CONTRIBUTION_ACTIONS.has(action)) {
    const todayTotal = await getTodayEarnings(userId);
    if (todayTotal >= config.dailyEarnCap) {
      return { success: false, awarded: 0, reason: 'daily_cap_reached' };
    }

    // Cap the award so it doesn't exceed daily limit
    const remaining = config.dailyEarnCap - todayTotal;
    amount = Math.min(amount, remaining);
  }

  // Apply diminishing returns
  const venueId = metadata.venue_id ?? null;
  const adjustedAmount = await getDiminishingAmount(userId, action, venueId, amount);
  if (adjustedAmount <= 0) {
    return { success: false, awarded: 0, reason: 'diminishing_returns' };
  }

  // Determine expiry for bonus credits (referral/streak bonuses expire)
  let expiresAt: string | null = null;
  const bonusActions = ['referral_complete', 'referral_milestone_3', 'streak_bonus'];
  if (bonusActions.includes(action) && config.bonusCreditExpiryDays > 0) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + config.bonusCreditExpiryDays);
    expiresAt = expiry.toISOString();
  }

  // Insert ledger entry
  const { error } = await supabase
    .from('focus_credits')
    .insert({
      user_id: userId,
      amount: adjustedAmount,
      action,
      metadata,
      expires_at: expiresAt,
    });

  if (error) {
    return { success: false, awarded: 0, reason: error.message };
  }

  return { success: true, awarded: adjustedAmount };
}

/**
 * Spend Focus Credits. Deducts from balance by inserting a negative ledger entry.
 * Returns success=false if insufficient balance.
 */
export async function spendCredits(
  userId: string,
  action: CreditAction,
  amount: number,
  metadata: CreditMetadata = {}
): Promise<AwardResult> {
  const balance = await getBalance(userId);
  if (balance < amount) {
    return { success: false, awarded: 0, reason: 'insufficient_balance' };
  }

  const { error } = await supabase
    .from('focus_credits')
    .insert({
      user_id: userId,
      amount: -amount,
      action,
      metadata,
      expires_at: null,
    });

  if (error) {
    return { success: false, awarded: 0, reason: error.message };
  }

  return { success: true, awarded: amount };
}

/**
 * Check if the user qualifies for a streak bonus (5+ sessions this month)
 * and award it if not already awarded this month.
 */
export async function checkAndAwardStreak(userId: string): Promise<AwardResult> {
  const config = getGrowthConfig().credits;
  const monthStartDate = monthStart();

  // Check if streak bonus already awarded this month
  const { data: existingBonus } = await supabase
    .from('focus_credits')
    .select('id')
    .eq('user_id', userId)
    .eq('action', 'streak_bonus')
    .gte('created_at', monthStartDate)
    .limit(1);

  if (existingBonus && existingBonus.length > 0) {
    return { success: false, awarded: 0, reason: 'already_awarded_this_month' };
  }

  // Count sessions completed this month
  const { data: monthSessions } = await supabase
    .from('focus_credits')
    .select('id')
    .eq('user_id', userId)
    .eq('action', 'session_complete')
    .gte('created_at', monthStartDate);

  const sessionCount = monthSessions?.length ?? 0;
  if (sessionCount < 5) {
    return { success: false, awarded: 0, reason: 'not_enough_sessions' };
  }

  const streakResult = await awardCredits(userId, 'streak_bonus', config.streakBonus, {
    sessions_this_month: sessionCount,
  } as CreditMetadata);

  if (streakResult.success) {
    toast(`\u{1F525} +${streakResult.awarded} FC \u2014 Streak bonus!`);
  }

  return streakResult;
}
