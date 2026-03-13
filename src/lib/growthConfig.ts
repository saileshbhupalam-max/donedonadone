/**
 * @module growthConfig
 * @description Single source of truth for ALL growth/credits/referral business logic.
 * Change any number and the entire system adapts.
 * Eventually load from app_settings table for runtime A/B testing.
 *
 * Key exports:
 * - GrowthConfig — Full type definition for the config object
 * - DEFAULT_GROWTH_CONFIG — Hardcoded defaults used when no runtime override exists
 * - loadGrowthConfig() — Async loader that merges runtime overrides from app_settings
 * - getGrowthConfig() — Sync getter returning cached config or defaults
 *
 * Dependencies: Supabase client (reads app_settings table)
 */
import { supabase } from "@/integrations/supabase/client";

// ─── Type Definitions ──────────────────────────────────

export interface DiminishingReturnsConfig {
  sameVenueReviewCap: number;
  sameVenuePhotoCap: number;
  reviewsPerDay: number;
  photosPerDay: number;
}

export interface QualityGatesConfig {
  minReviewLength: number;
  minPhotoSizeKB: number;
  peerRatingConsensus: number;
}

export interface CreditsConfig {
  // Earning (faucets)
  sessionComplete: number;
  rateGroup: number;
  rateVenue: number;
  writeReview: number;
  uploadPhoto: number;
  reportVenueInfo: number;
  referralComplete: number;
  referralMilestone3: number;
  streakBonus: number;
  greatGroupmate: number;
  addNewVenue: number;
  verifyVenueInfo: number;
  checkInPhoto: number;
  reportCompanyPresence: number;
  reportSeatingCapacity: number;
  reportFloorCount: number;
  reportAmenities: number;

  // Spending (sinks)
  freeSession: number;
  priorityMatching: number;
  venueUpgrade: number;
  pickSeat: number;
  giftSession: number;
  exclusiveSession: number;

  // Anti-inflation
  dailyEarnCap: number;
  diminishingReturns: DiminishingReturnsConfig;
  bonusCreditExpiryDays: number;
  qualityGates: QualityGatesConfig;
}

export interface ReferralConfig {
  referrerReward: 'free_session' | 'credits';
  refereeReward: 'free_session' | 'credits';
  referrerCredits: number;
  refereeCredits: number;
  milestone5Badge: boolean;
  milestone5Discount: number;
  milestone10Title: string;
  maxReferralRewards: number;
}

export interface GrowthNudgeConfig {
  nudgeAfterGoodSession: boolean;
  nudgeAfterMilestone: boolean;
  nudgeWhenNoSlots: boolean;
  nudgeDelayAfterSession: number;
  neighborhoodWaitlistEnabled: boolean;
  neighborhoodLaunchThreshold: number;
  premiumDaysForContributions: number;
  contributionMilestoneActions: number;
}

export interface VenueDataConfig {
  collectNoise: boolean;
  collectWifi: boolean;
  collectSeating: boolean;
  collectPhotos: boolean;
  collectCompanyPresence: boolean;
  collectFloorCount: boolean;
  collectAmenities: boolean;
  collectPowerOutlets: boolean;
  collectParkingInfo: boolean;
  collectFoodOptions: boolean;
  photoAIVerification: boolean;
  minPhotosForVerifiedBadge: number;
  dataFreshnessPromptDays: number;
}

export interface GrowthConfig {
  credits: CreditsConfig;
  referral: ReferralConfig;
  growth: GrowthNudgeConfig;
  venueData: VenueDataConfig;
}

// ─── Default Configuration ──────────────────────────────

export const DEFAULT_GROWTH_CONFIG: GrowthConfig = {
  credits: {
    // Earning (faucets)
    sessionComplete: 10,
    rateGroup: 5,
    rateVenue: 5,
    writeReview: 15,
    uploadPhoto: 5,
    reportVenueInfo: 10,
    referralComplete: 50,
    referralMilestone3: 25,
    streakBonus: 25,
    greatGroupmate: 10,
    addNewVenue: 30,
    verifyVenueInfo: 3,
    checkInPhoto: 5,
    reportCompanyPresence: 10,
    reportSeatingCapacity: 10,
    reportFloorCount: 5,
    reportAmenities: 5,

    // Spending (sinks)
    freeSession: 100,
    priorityMatching: 30,
    venueUpgrade: 50,
    pickSeat: 20,
    giftSession: 100,
    exclusiveSession: 40,

    // Anti-inflation
    dailyEarnCap: 50,
    diminishingReturns: {
      sameVenueReviewCap: 3,
      sameVenuePhotoCap: 5,
      reviewsPerDay: 3,
      photosPerDay: 10,
    },
    bonusCreditExpiryDays: 30,
    qualityGates: {
      minReviewLength: 50,
      minPhotoSizeKB: 50,
      peerRatingConsensus: 2,
    },
  },

  referral: {
    referrerReward: 'credits',
    refereeReward: 'free_session',
    referrerCredits: 50,
    refereeCredits: 100,
    milestone5Badge: true,
    milestone5Discount: 10,
    milestone10Title: 'Community Builder',
    maxReferralRewards: -1,
  },

  growth: {
    nudgeAfterGoodSession: true,
    nudgeAfterMilestone: true,
    nudgeWhenNoSlots: true,
    nudgeDelayAfterSession: 5,
    neighborhoodWaitlistEnabled: true,
    neighborhoodLaunchThreshold: 10,
    premiumDaysForContributions: 1,
    contributionMilestoneActions: 3,
  },

  venueData: {
    collectNoise: true,
    collectWifi: true,
    collectSeating: true,
    collectPhotos: true,
    collectCompanyPresence: true,
    collectFloorCount: true,
    collectAmenities: true,
    collectPowerOutlets: true,
    collectParkingInfo: true,
    collectFoodOptions: true,
    photoAIVerification: false,
    minPhotosForVerifiedBadge: 5,
    dataFreshnessPromptDays: 30,
  },
};

// ─── Runtime Config Loading ──────────────────────────────

let runtimeConfig: GrowthConfig | null = null;

/**
 * Load growth config from app_settings table, falling back to defaults.
 * Merges runtime overrides on top of DEFAULT_GROWTH_CONFIG so partial
 * overrides work correctly.
 */
export async function loadGrowthConfig(): Promise<GrowthConfig> {
  if (runtimeConfig) return runtimeConfig;
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'growth_config')
      .single();
    if (data?.value) {
      const override = data.value as Record<string, any>;
      runtimeConfig = {
        credits: { ...DEFAULT_GROWTH_CONFIG.credits, ...override.credits },
        referral: { ...DEFAULT_GROWTH_CONFIG.referral, ...override.referral },
        growth: { ...DEFAULT_GROWTH_CONFIG.growth, ...override.growth },
        venueData: { ...DEFAULT_GROWTH_CONFIG.venueData, ...override.venueData },
      };
      return runtimeConfig;
    }
  } catch {
    // use defaults
  }
  return DEFAULT_GROWTH_CONFIG;
}

/** Sync getter — returns cached runtime config or defaults. */
export function getGrowthConfig(): GrowthConfig {
  return runtimeConfig || DEFAULT_GROWTH_CONFIG;
}

/** Reset cached config (useful for testing or forcing reload). */
export function resetGrowthConfigCache(): void {
  runtimeConfig = null;
}
