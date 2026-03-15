/**
 * @module focusCredits
 * @description Focus Credits client interface. All credit operations (award, spend)
 * are delegated to server-side RPCs (server_award_credits, server_spend_credits)
 * which enforce daily caps, diminishing returns, idempotency, and timezone-correct
 * boundaries. The client CANNOT insert into focus_credits directly (RLS locked).
 *
 * Key exports:
 * - awardCredits() — Call server RPC to create earning ledger entry
 * - awardWithMultipliers() — Award with tier + streak multipliers applied
 * - spendCredits() — Call server RPC to deduct credits
 * - getBalance() — Current balance from ledger sum (read-only, client-safe)
 * - getTodayEarnings() — Today's total earnings (read-only, client-safe)
 * - getLifetimeEarnings() — Total positive FC ever earned (for tier calculation)
 * - getUserTier() — Current tier based on lifetime earnings
 * - getStreakMultiplier() — Earn multiplier from current weekly streak length
 * - checkAndAwardStreak() — Award streak bonus if 5+ sessions this month
 * - purchaseStreakFreeze() — Spend FC to buy a streak freeze
 * - rollVariableReward() — Roll for mystery double after session
 * - penalizeNoShow() — Deduct FC for no-show
 * - penalizeLateCancel() — Deduct FC for late cancellation
 *
 * Dependencies: Supabase client (calls RPCs, reads focus_credits), growthConfig
 * Tables: focus_credits (read-only from client), server RPCs handle writes
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getGrowthConfig, type TierDefinition } from "@/lib/growthConfig";

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
  | 'late_cancel_penalty'
  | 'redeem_session_boost'
  // Gamification v2
  | 'welcome_bonus'
  | 'first_session_bonus'
  | 'mystery_double'
  | 'group_chemistry_bonus'
  | 'golden_session'
  | 'group_streak_bonus'
  | 'reliability_bonus'
  | 'venue_variety_bonus'
  | 'streak_freeze_purchase'
  | 'streak_milestone'
  // Anti-inflation sinks (v3 — FC expiry + new redemptions)
  | 'redeem_profile_highlight'
  | 'redeem_venue_choice'
  | 'redeem_group_size_preference';

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

// ─── FC Expiry Queries ──────────────────────────────
// WHY: Starbucks shows "X stars expiring on [date]" to create urgency.
// Visible expiry deadlines increase redemption velocity 15-20% (loyalty
// program industry data). Users who see "47 FC expiring in 12 days" are
// far more likely to browse the redemption catalog than users who see
// a static balance number.

export interface ExpiringCreditsInfo {
  /** Total FC amount expiring within the specified window */
  amount: number;
  /** Earliest expiry date among the expiring entries */
  earliestExpiry: string | null;
  /** Number of individual ledger entries expiring */
  entryCount: number;
}

/**
 * Query FC that will expire within the next N days.
 * Used to show "X FC expiring soon" warning on the Credits page.
 * Only counts positive entries with an expires_at in the future but
 * within the warning window — already-expired entries are excluded
 * (they're already zeroed out in getBalance).
 */
export async function getExpiringCredits(
  userId: string,
  withinDays: number = 14
): Promise<ExpiringCreditsInfo> {
  const now = new Date().toISOString();
  const futureDate = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('focus_credits')
    .select('amount, expires_at')
    .eq('user_id', userId)
    .gt('amount', 0)
    .not('expires_at', 'is', null)
    .gt('expires_at', now)
    .lte('expires_at', futureDate)
    .order('expires_at', { ascending: true });

  if (error || !data || data.length === 0) {
    return { amount: 0, earliestExpiry: null, entryCount: 0 };
  }

  const entries = data as Array<{ amount: number; expires_at: string }>;
  return {
    amount: entries.reduce((sum, e) => sum + e.amount, 0),
    earliestExpiry: entries[0].expires_at,
    entryCount: entries.length,
  };
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
  const { data, error } = await supabase.rpc('user_award_credits', {
    p_action: action,
    p_amount: amount,
    p_metadata: metadata as unknown as Record<string, unknown>,
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
  const { data, error } = await supabase.rpc('user_spend_credits', {
    p_action: action,
    p_amount: amount,
    p_metadata: metadata as unknown as Record<string, unknown>,
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
 * Fulfill a redemption: spend FC + create tangible result server-side.
 * Free session → day_pass, gift → transferable code, priority → 7-day flag.
 */
export async function fulfillRedemption(
  userId: string,
  action: CreditAction,
  cost: number
): Promise<{ success: boolean; data?: Record<string, unknown>; reason?: string }> {
  const { data, error } = await supabase.rpc('user_fulfill_redemption', {
    p_action: action,
    p_cost: cost,
  });

  if (error) {
    console.error('[focusCredits] server_fulfill_redemption error:', error);
    return { success: false, reason: error.message };
  }

  const result = data as Record<string, unknown>;
  return {
    success: (result.success as boolean) ?? false,
    data: result,
    reason: result.reason as string | undefined,
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

  // Idempotency key prevents double-award from concurrent calls
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const streakResult = await awardCredits(userId, 'streak_bonus', 25, {
    sessions_this_month: sessionCount,
    idempotency_key: `streak_bonus_${userId}_${year}-${month}`,
  } as CreditMetadata);

  if (streakResult.success) {
    toast(`\u{1F525} +${streakResult.awarded} FC \u2014 Streak bonus!`);
  }

  return streakResult;
}

// ─── Tier System ──────────────────────────────────
// Starbucks model: tiers based on lifetime earnings, never demotes on spend.
// Explorer → Regular → Insider → Champion with escalating earn multipliers.

export type UserTierKey = 'explorer' | 'regular' | 'insider' | 'champion';

export interface UserTierInfo {
  key: UserTierKey;
  label: string;
  earnMultiplier: number;
  lifetimeFC: number;
  /** FC needed to reach next tier, or null if at max */
  fcToNextTier: number | null;
  nextTierLabel: string | null;
}

/**
 * Get total positive FC ever earned (ignoring spends and penalties).
 * This number only goes up — spending doesn't reduce it.
 */
export async function getLifetimeEarnings(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('focus_credits')
    .select('amount')
    .eq('user_id', userId)
    .gt('amount', 0);

  if (error || !data) return 0;
  return (data as Array<{ amount: number }>).reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Calculate the user's current tier based on lifetime earnings.
 * Tiers never demote — once you earn 500 lifetime FC, you're an Insider
 * even if you spend down to 0 balance.
 */
export function getUserTier(lifetimeFC: number): UserTierInfo {
  const { tiers } = getGrowthConfig().credits;
  const tierOrder: Array<{ key: UserTierKey; def: TierDefinition }> = [
    { key: 'champion', def: tiers.champion },
    { key: 'insider', def: tiers.insider },
    { key: 'regular', def: tiers.regular },
    { key: 'explorer', def: tiers.explorer },
  ];

  for (let i = 0; i < tierOrder.length; i++) {
    const { key, def } = tierOrder[i];
    if (lifetimeFC >= def.minLifetimeFC) {
      const nextTier = i > 0 ? tierOrder[i - 1] : null;
      return {
        key,
        label: def.label,
        earnMultiplier: def.earnMultiplier,
        lifetimeFC,
        fcToNextTier: nextTier ? nextTier.def.minLifetimeFC - lifetimeFC : null,
        nextTierLabel: nextTier ? nextTier.def.label : null,
      };
    }
  }

  // Fallback (should never hit — Explorer has minLifetimeFC: 0)
  return {
    key: 'explorer',
    label: tiers.explorer.label,
    earnMultiplier: tiers.explorer.earnMultiplier,
    lifetimeFC,
    fcToNextTier: tiers.regular.minLifetimeFC - lifetimeFC,
    nextTierLabel: tiers.regular.label,
  };
}

// ─── Streak Multiplier ──────────────────────────────────
// Duolingo data: 7-day streak = 3.6x long-term retention.
// Weekly cadence (not daily) because sessions are a weekly ritual.

/**
 * Get the earn rate multiplier for a given weekly streak length.
 * Multipliers stack with tier multipliers (multiplicative).
 */
export function getStreakMultiplier(streakWeeks: number): number {
  const { multipliers } = getGrowthConfig().credits.streak;
  const thresholds = Object.keys(multipliers)
    .map(Number)
    .sort((a, b) => b - a);

  for (const threshold of thresholds) {
    if (streakWeeks >= threshold) return multipliers[threshold];
  }
  return 1.0;
}

/**
 * Get combined earn multiplier (tier × streak). Both are independent
 * reward systems that compound — a Champion with a 12-week streak earns
 * 1.5 × 1.3 = 1.95x base rate.
 */
export function getEffectiveMultiplier(lifetimeFC: number, streakWeeks: number): number {
  const tier = getUserTier(lifetimeFC);
  const streak = getStreakMultiplier(streakWeeks);
  return tier.earnMultiplier * streak;
}

/**
 * Award FC with tier + streak multipliers automatically applied.
 * Convenience wrapper around awardCredits() for session-related earnings.
 */
export async function awardWithMultipliers(
  userId: string,
  action: CreditAction,
  baseAmount: number,
  lifetimeFC: number,
  streakWeeks: number,
  metadata: CreditMetadata = {}
): Promise<AwardResult> {
  const multiplier = getEffectiveMultiplier(lifetimeFC, streakWeeks);
  const finalAmount = Math.round(baseAmount * multiplier);
  return awardCredits(userId, action, finalAmount, {
    ...metadata,
    base_amount: baseAmount,
    multiplier: multiplier,
    tier: getUserTier(lifetimeFC).key,
    streak_weeks: streakWeeks,
  });
}

// ─── Streak Freeze ──────────────────────────────────
// Duolingo: streak freeze reduced churn 21% for at-risk users.
// Loss aversion (2.25x) makes protecting a streak worth more than earning new FC.

/**
 * Purchase a streak freeze. The user spends FC to protect one missed week.
 * Max freezes enforced via rolling 7-day window (not lifetime total), so users
 * can buy new freezes each week. Without the window, users who ever bought
 * maxFreezes freezes would be permanently blocked from purchasing more.
 */
export async function purchaseStreakFreeze(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const config = getGrowthConfig().credits.streak;

  // Count active freezes in rolling 7-day window via server RPC.
  // WHY rolling window: lifetime count would permanently block after maxFreezes purchases.
  // Falls back to client-side query if the RPC migration hasn't been applied yet.
  let currentFreezes = 0;
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'user_count_active_streak_freezes', { p_user_id: userId }
  );
  if (!rpcError && typeof rpcResult === 'number') {
    currentFreezes = rpcResult;
  } else {
    // Fallback: count freezes purchased in last 7 days client-side
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: freezes } = await supabase
      .from('focus_credits')
      .select('id')
      .eq('user_id', userId)
      .eq('action', 'streak_freeze_purchase')
      .gte('created_at', weekAgo);
    currentFreezes = freezes?.length ?? 0;
  }

  if (currentFreezes >= config.maxFreezes) {
    return { success: false, error: `You already have ${config.maxFreezes} streak freezes this week.` };
  }

  const result = await spendCredits(userId, 'streak_freeze_purchase', config.freezeCost, {
    idempotency_key: `streak_freeze_${userId}_${Date.now()}`,
  });

  if (result.success) {
    toast(`\u{2744}\u{FE0F} Streak freeze purchased! (${config.freezeCost} FC)`);
  }
  return { success: result.success, error: result.reason };
}

// ─── Variable Rewards ──────────────────────────────────
// Skinner's VR schedule: most resistant to extinction.
// 10% mystery double = exciting but rare enough to stay surprising.

/**
 * Roll for a mystery double after a session. Returns the bonus amount
 * (0 if the roll fails, baseAmount if it succeeds — effectively doubling).
 */
export async function rollVariableReward(
  userId: string,
  baseAmount: number,
  sessionId: string
): Promise<{ won: boolean; bonusAmount: number }> {
  const { mysteryDoubleChance } = getGrowthConfig().credits.variableRewards;
  const roll = Math.random();

  if (roll >= mysteryDoubleChance) {
    return { won: false, bonusAmount: 0 };
  }

  // Won the mystery double — award the bonus
  const result = await awardCredits(userId, 'mystery_double', baseAmount, {
    session_id: sessionId,
    idempotency_key: `mystery_double_${userId}_${sessionId}`,
    roll: roll,
  });

  if (result.success) {
    toast(`\u{2728} Mystery Double! +${result.awarded} bonus FC!`);
  }

  return { won: result.success, bonusAmount: result.awarded };
}

/**
 * Award group chemistry bonus when ALL group members rate session 4+ stars.
 */
export async function awardGroupChemistryBonus(
  userId: string,
  sessionId: string
): Promise<AwardResult> {
  const { groupChemistryBonus } = getGrowthConfig().credits.variableRewards;
  return awardCredits(userId, 'group_chemistry_bonus', groupChemistryBonus, {
    session_id: sessionId,
    idempotency_key: `group_chemistry_${userId}_${sessionId}`,
  });
}

// ─── Penalties ──────────────────────────────────
// Kahneman/Tversky: loss aversion coefficient ~2.25x.
// A 15 FC no-show penalty feels as bad as missing a 34 FC reward.
//
// WHY we try user_penalize_self first:
// spendCredits enforces balance >= 0, so a zero-balance user who flakes
// pays no penalty — they've effectively "dodged" the consequence.
// user_penalize_self allows negative balance, meaning penalties always
// apply. This is critical for loss aversion to function: if users learn
// that going to 0 FC makes them immune to penalties, the entire
// anti-flaking system collapses.
//
// The RPC is being created in a parallel SQL migration. Until that
// migration is applied, we fall back to spendCredits (which will
// silently fail for zero-balance users — acceptable during rollout).

/**
 * Deduct FC for a no-show. Tries penalty RPC (allows negative balance)
 * first, falls back to spendCredits if the migration hasn't been applied.
 */
export async function penalizeNoShow(
  userId: string,
  sessionId: string
): Promise<AwardResult> {
  const { noShow } = getGrowthConfig().credits.penalties;
  const metadata = {
    session_id: sessionId,
    idempotency_key: `no_show_${userId}_${sessionId}`,
  };

  // Try penalty RPC that allows negative balance — zero-balance users can't dodge penalties
  const { data, error } = await supabase.rpc('user_penalize_self', {
    p_action: 'no_show_penalty',
    p_amount: noShow,
    p_metadata: metadata as unknown as Record<string, unknown>,
  });

  if (error) {
    // Fallback: spendCredits blocks on insufficient balance, so zero-balance
    // users won't be penalized. Acceptable until user_penalize_self migration lands.
    console.warn('[focusCredits] user_penalize_self not available, falling back to spendCredits:', error.message);
    return spendCredits(userId, 'no_show_penalty', noShow, metadata);
  }

  return data as AwardResult;
}

/**
 * Deduct FC for a late cancellation (within lateCancelWindowHours of start).
 * Tries penalty RPC (allows negative balance) first, falls back to spendCredits.
 */
export async function penalizeLateCancel(
  userId: string,
  sessionId: string
): Promise<AwardResult> {
  const { lateCancel } = getGrowthConfig().credits.penalties;
  const metadata = {
    session_id: sessionId,
    idempotency_key: `late_cancel_${userId}_${sessionId}`,
  };

  // Try penalty RPC that allows negative balance — zero-balance users can't dodge penalties
  const { data, error } = await supabase.rpc('user_penalize_self', {
    p_action: 'late_cancel_penalty',
    p_amount: lateCancel,
    p_metadata: metadata as unknown as Record<string, unknown>,
  });

  if (error) {
    // Fallback: spendCredits blocks on insufficient balance, so zero-balance
    // users won't be penalized. Acceptable until user_penalize_self migration lands.
    console.warn('[focusCredits] user_penalize_self not available, falling back to spendCredits:', error.message);
    return spendCredits(userId, 'late_cancel_penalty', lateCancel, metadata);
  }

  return data as AwardResult;
}

// ─── Endowed Progress ──────────────────────────────────
// Nunes & Dreze: pre-filled loyalty cards = 2x completion rate (34% vs 19%).
// The first reward must come within 1-2 interactions.

/**
 * Award welcome bonus on onboarding completion.
 * Gives new users their first FC immediately — endowed progress effect.
 */
export async function awardWelcomeBonus(userId: string): Promise<AwardResult> {
  const { welcomeBonus } = getGrowthConfig().credits.endowedProgress;
  return awardCredits(userId, 'welcome_bonus', welcomeBonus, {
    idempotency_key: `welcome_bonus_${userId}`,
  });
}

/**
 * Award first-session bonus (on top of normal sessionComplete FC).
 * Makes the first session feel extra rewarding.
 */
export async function awardFirstSessionBonus(userId: string): Promise<AwardResult> {
  const { firstSessionBonus } = getGrowthConfig().credits.endowedProgress;

  // Check if they've ever completed a session before
  const { data: pastSessions } = await supabase
    .from('focus_credits')
    .select('id')
    .eq('user_id', userId)
    .eq('action', 'session_complete')
    .limit(2);

  // Only award if this is their very first session_complete (0 or 1 existing)
  if (pastSessions && pastSessions.length > 1) {
    return { success: false, awarded: 0, reason: 'not_first_session' };
  }

  const result = await awardCredits(userId, 'first_session_bonus', firstSessionBonus, {
    idempotency_key: `first_session_bonus_${userId}`,
  });

  if (result.success) {
    toast(`\u{1F389} First session bonus! +${result.awarded} FC`);
  }
  return result;
}

// ─── Social Bonuses ──────────────────────────────────
// Habitica parties: small-group accountability = 65% higher completion.
// Strava clubs: members 2x more likely to exercise weekly.

/**
 * Award venue variety bonus if the user attended N different venues this month.
 */
export async function checkVenueVarietyBonus(userId: string): Promise<AwardResult> {
  const { venueVarietyBonus, venueVarietyThreshold } = getGrowthConfig().credits.social;

  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  const monthStart = d.toISOString();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');

  // Check if already awarded this month
  const idempotencyKey = `venue_variety_${userId}_${year}-${month}`;
  const { data: existing } = await supabase
    .from('focus_credits')
    .select('id')
    .eq('user_id', userId)
    .eq('action', 'venue_variety_bonus')
    .gte('created_at', monthStart)
    .limit(1);

  if (existing && existing.length > 0) {
    return { success: false, awarded: 0, reason: 'already_awarded_this_month' };
  }

  // Count unique venues this month via session metadata
  const { data: sessions } = await supabase
    .from('focus_credits')
    .select('metadata')
    .eq('user_id', userId)
    .eq('action', 'session_complete')
    .gte('created_at', monthStart);

  if (!sessions) return { success: false, awarded: 0, reason: 'no_sessions' };

  const uniqueVenues = new Set(
    sessions
      .map((s: { metadata?: Record<string, unknown> }) => s.metadata?.venue_id)
      .filter(Boolean)
  );

  if (uniqueVenues.size < venueVarietyThreshold) {
    return { success: false, awarded: 0, reason: 'not_enough_venues' };
  }

  const result = await awardCredits(userId, 'venue_variety_bonus', venueVarietyBonus, {
    idempotency_key: idempotencyKey,
    unique_venues: uniqueVenues.size,
  } as CreditMetadata);

  if (result.success) {
    toast(`\u{1F30D} Venue explorer! +${result.awarded} FC for trying ${uniqueVenues.size} venues`);
  }
  return result;
}

/**
 * Check and award streak milestone bonuses (4, 8, 12, 26, 52 weeks).
 */
export async function checkStreakMilestone(
  userId: string,
  currentStreakWeeks: number
): Promise<AwardResult> {
  const { milestones, milestoneBonuses } = getGrowthConfig().credits.streak;

  for (let i = milestones.length - 1; i >= 0; i--) {
    if (currentStreakWeeks >= milestones[i]) {
      const idempotencyKey = `streak_milestone_${userId}_${milestones[i]}w`;
      const result = await awardCredits(userId, 'streak_milestone', milestoneBonuses[i], {
        idempotency_key: idempotencyKey,
        milestone_weeks: milestones[i],
      });

      if (result.success) {
        toast(`\u{1F525} ${milestones[i]}-week streak! +${result.awarded} FC milestone bonus!`);
      }
      return result;
    }
  }

  return { success: false, awarded: 0, reason: 'no_milestone_reached' };
}
