/**
 * @module engagementScore
 * @description Engagement score and churn risk predictor. Uses weighted signals from
 * the last 30 days to identify at-risk users before they churn.
 *
 * Research basis:
 * - Recency bias: Recent activity predicts future behavior better than lifetime totals
 * - Multi-signal: Single metrics (like "last login") miss users who browse but don't engage
 * - Threshold-based risk: Churn risk is non-linear — below certain activity, risk spikes
 *
 * Weights tuned for coworking context:
 * - Sessions (15/ea): Core value prop — attending sessions is the strongest retention signal
 * - Connections (10/ea): Social bonds create switching costs (Habitica party effect)
 * - Streak (5/day): Consistency habit — Duolingo data shows 7-day streak = 3.6x retention
 * - FC earned (2/ea): Economic investment — sunk cost keeps users engaged
 * - Contributions (8/ea): Community investment — venue reports, reviews create ownership
 *
 * Score: 0-100, higher = more engaged
 * Churn risk: high (<20), medium (20-49), low (50+)
 *
 * Key exports: EngagementInput, EngagementResult, computeEngagementScore
 * Dependencies: None (pure function)
 * Related: progressionStats.ts (data source), checkAllProgression.ts (caller)
 */

export interface EngagementInput {
  sessionsLast30d: number;
  connectionsLast30d: number;
  streakDays: number;
  fcEarnedLast30d: number;
  contributionsLast30d: number;
}

export interface EngagementResult {
  score: number;
  churnRisk: "low" | "medium" | "high";
}

export function computeEngagementScore(input: EngagementInput): EngagementResult {
  // Weighted sum — each signal captures a different engagement dimension.
  // Previously only used sessions/connections/streak with lifetime totals,
  // making it useless as a churn predictor. Now uses 5 signals scoped to
  // the last 30 days for actual recency-based risk detection.
  const rawScore =
    (input.sessionsLast30d * 15) +      // Core: attending sessions
    (input.connectionsLast30d * 10) +    // Social: connections create switching costs
    (input.streakDays * 5) +             // Habit: consistency predicts retention
    (input.fcEarnedLast30d * 2) +        // Economic: FC investment increases commitment
    (input.contributionsLast30d * 8);    // Community: venue reports, reviews = ownership

  const score = Math.min(100, rawScore);

  // Non-linear risk thresholds — below 20 is danger zone
  let churnRisk: "low" | "medium" | "high";
  if (score < 20) churnRisk = "high";
  else if (score < 50) churnRisk = "medium";
  else churnRisk = "low";

  return { score, churnRisk };
}
