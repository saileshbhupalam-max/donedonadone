/**
 * Pure functions extracted from compute_engagement_score RPC
 * for testability. Mirrors the logic in the migration SQL.
 */

export interface EngagementInput {
  sessionsLast30d: number;
  connectionsLast30d: number;
  streakDays: number;
}

export interface EngagementResult {
  score: number;
  churnRisk: "low" | "medium" | "high";
}

export function computeEngagementScore(input: EngagementInput): EngagementResult {
  const rawScore = (input.sessionsLast30d * 15) + (input.connectionsLast30d * 10) + (input.streakDays * 5);
  const score = Math.min(100, rawScore);

  let churnRisk: "low" | "medium" | "high";
  if (score < 20) churnRisk = "high";
  else if (score < 50) churnRisk = "medium";
  else churnRisk = "low";

  return { score, churnRisk };
}
