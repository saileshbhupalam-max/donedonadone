/**
 * @module focusCredits
 * @description Focus Credits client interface. All credit operations (award, spend)
 * are delegated to server-side RPCs (server_award_credits, server_spend_credits)
 * which enforce daily caps, diminishing returns, idempotency, and timezone-correct
 * boundaries. The client CANNOT insert into focus_credits directly (RLS locked).
 *
 * Key exports:
 * - awardCredits() — Call server RPC to create earning ledger entry
 * - spendCredits() — Call server RPC to deduct credits
 * - getBalance() — Current balance from ledger sum (read-only, client-safe)
 * - getTodayEarnings() — Today's total earnings (read-only, client-safe)
 * - checkAndAwardStreak() — Award streak bonus if 5+ sessions this month
 *
 * Dependencies: Supabase client (calls RPCs, reads focus_credits)
 * Tables: focus_credits (read-only from client), server RPCs handle writes
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  | 'taste_answer'
  | 'no_show_penalty'
  | 'late_cancel_penalty';

export interface CreditMetadata {
  venue_id?: string;
  session_id?: string;
  referral_user_id?: string;
  review_length?: number;
  photo_size_kb?: number;
  idempotency_key?: string;
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

// ─── Read-Only Functions (client-safe) ──────────────────

/**
 * Get the user's current Focus Credits balance (sum of all ledger entries,
 * excluding expired bonus credits). Read-only — no security concern.
 */
export async function getBalance(userId: string): Promise<number> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('focus_credits')
    .select('amount, expires_at')
    .eq('user_id', userId);

  if (error || !data) return 0;

  return (data as Array<{ amount: number; expires_at: string | null }>).reduce(
    (sum, entry) => {
      if (entry.expires_at && entry.expires_at < now) return sum;
      return sum + entry.amount;
    },
    0
  );
}

/**
 * Get total earnings for today (used for daily cap display).
 * Read-only — no security concern.
 */
export async function getTodayEarnings(userId: string): Promise<number> {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const todayStart = d.toISOString();

  const { data, error } = await supabase
    .from('focus_credits')
    .select('amount')
    .eq('user_id', userId)
    .gt('amount', 0)
    .gte('created_at', todayStart);

  if (error || !data) return 0;

  return (data as Array<{ amount: number }>).reduce(
    (sum, entry) => sum + entry.amount,
    0
  );
}

// ─── Server-Side Write Operations ──────────────────

/**
 * Award Focus Credits via server RPC. All validation (daily caps,
 * diminishing returns, timezone boundaries, idempotency) is enforced
 * server-side. The client cannot bypass these checks.
 */
export async function awardCredits(
  userId: string,
  action: CreditAction,
  amount: number,
  metadata: CreditMetadata = {}
): Promise<AwardResult> {
  const { data, error } = await supabase.rpc('server_award_credits', {
    p_user_id: userId,
    p_action: action,
    p_amount: amount,
    p_metadata: metadata as any,
    p_idempotency_key: metadata.idempotency_key ?? null,
  });

  if (error) {
    console.error('[focusCredits] server_award_credits error:', error);
    return { success: false, awarded: 0, reason: error.message };
  }

  const result = data as { success: boolean; awarded: number; reason?: string };
  return {
    success: result.success,
    awarded: result.awarded,
    reason: result.reason,
  };
}

/**
 * Spend Focus Credits via server RPC. Balance check is enforced
 * server-side to prevent race conditions.
 */
export async function spendCredits(
  userId: string,
  action: CreditAction,
  amount: number,
  metadata: CreditMetadata = {}
): Promise<AwardResult> {
  const { data, error } = await supabase.rpc('server_spend_credits', {
    p_user_id: userId,
    p_action: action,
    p_amount: amount,
    p_metadata: metadata as any,
  });

  if (error) {
    console.error('[focusCredits] server_spend_credits error:', error);
    return { success: false, awarded: 0, reason: error.message };
  }

  const result = data as { success: boolean; awarded: number; reason?: string };
  return {
    success: result.success,
    awarded: result.awarded,
    reason: result.reason,
  };
}

/**
 * Check if the user qualifies for a streak bonus (5+ sessions this month)
 * and award it if not already awarded this month.
 */
export async function checkAndAwardStreak(userId: string): Promise<AwardResult> {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  const monthStartDate = d.toISOString();

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

  const streakResult = await awardCredits(userId, 'streak_bonus', 25, {
    sessions_this_month: sessionCount,
  } as CreditMetadata);

  if (streakResult.success) {
    toast(`\u{1F525} +${streakResult.awarded} FC \u2014 Streak bonus!`);
  }

  return streakResult;
}
