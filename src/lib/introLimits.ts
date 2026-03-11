/**
 * Pure function extracted from CompanyMatches intro state logic
 * for testability.
 */

export interface IntroState {
  zeroLimit: boolean;    // monthly limit is 0 (free/plus)
  unlimited: boolean;    // monthly limit is -1 (max)
  remaining: number;     // intros remaining this month
  atLimit: boolean;      // at or over monthly limit
  useCredit: boolean;    // at limit but has credits
  blocked: boolean;      // at limit and no credits
  allowed: boolean;      // can send an intro
  credits: number;       // available intro credits
}

export function computeIntroState(
  monthlyLimit: number,
  monthlyUsed: number,
  credits: number
): IntroState {
  const zeroLimit = monthlyLimit === 0;
  const unlimited = monthlyLimit === -1;
  const remaining = unlimited ? -1 : Math.max(0, monthlyLimit - monthlyUsed);
  const atLimit = !unlimited && monthlyUsed >= monthlyLimit;
  const useCredit = atLimit && credits > 0 && !zeroLimit;
  const blocked = (atLimit && credits === 0 && !zeroLimit) || zeroLimit;
  const allowed = !blocked && (unlimited || !atLimit || useCredit);

  return {
    zeroLimit,
    unlimited,
    remaining,
    atLimit,
    useCredit,
    blocked,
    allowed,
    credits,
  };
}
