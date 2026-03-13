/**
 * Pure functions extracted from useSubscription hook
 * for testability. Mirrors the hasFeature and getLimit logic.
 */
import { parseISO } from "date-fns";

export interface TierInfo {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface TierFeature {
  feature_key: string;
  min_tier_id: string;
  is_active: boolean;
}

export interface TierLimit {
  tier_id: string;
  limit_key: string;
  limit_value: number;
}

export function hasFeature(
  key: string,
  userTierOrder: number,
  allFeatures: TierFeature[],
  allTiers: TierInfo[]
): boolean {
  const feature = allFeatures.find((f) => f.feature_key === key);
  if (!feature) return false;
  const minTier = allTiers.find((t) => t.id === feature.min_tier_id);
  if (!minTier) return false;
  return userTierOrder >= minTier.sort_order;
}

export function getLimit(
  key: string,
  currentTierId: string,
  allLimits: TierLimit[]
): number {
  const limit = allLimits.find((l) => l.tier_id === currentTierId && l.limit_key === key);
  return limit?.limit_value ?? 0;
}

export function resolveEffectiveTier(
  subscriptionTierOrder: number,
  boostTierOrder: number | null,
  boostExpiresAt: string | null
): number {
  if (boostTierOrder !== null && boostExpiresAt) {
    const expires = parseISO(boostExpiresAt);
    if (expires > new Date()) {
      return Math.max(subscriptionTierOrder, boostTierOrder);
    }
  }
  return subscriptionTierOrder;
}
