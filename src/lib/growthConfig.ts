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

// ─── Tier System (Starbucks model: lifetime-earned based, never demotes) ───
export interface TierDefinition {
  minLifetimeFC: number;
  earnMultiplier: number;
  label: string;
}

export interface TierConfig {
  explorer: TierDefinition;
  regular: TierDefinition;
  insider: TierDefinition;
  champion: TierDefinition;
}

// ─── Streak System (Duolingo model: weekly cadence, freeze purchasable) ───
export interface StreakConfig {
  /** Minimum sessions per week to maintain streak */
  sessionsPerWeek: number;
  /** FC cost to purchase a streak freeze */
  freezeCost: number;
  /** Max streak freezes a user can hold at once */
  maxFreezes: number;
  /** Week milestones that award bonus FC (e.g. [4, 8, 12, 26, 52]) */
  milestones: number[];
  /** Bonus FC awarded at each milestone (parallel to milestones array) */
  milestoneBonuses: number[];
  /** Streak length thresholds → earn rate multiplier.
   * Keys are week counts; multiplier applies from that week onward.
   * Example: { 1: 1.0, 4: 1.1, 8: 1.2, 12: 1.3 } */
  multipliers: Record<number, number>;
}

// ─── Variable Rewards (ethical dopamine: unpredictable bonuses) ───
export interface VariableRewardConfig {
  /** Chance (0-1) of earning 2x FC after any session */
  mysteryDoubleChance: number;
  /** Bonus FC when ALL group members rate session 4+ stars */
  groupChemistryBonus: number;
  /** Earn multiplier for admin-designated "golden sessions" */
  goldenSessionMultiplier: number;
}

// ─── Penalties (ClassPass model: sting because FC have real value) ───
export interface PenaltyConfig {
  /** FC deducted for no-show */
  noShow: number;
  /** FC deducted for late cancellation */
  lateCancel: number;
  /** Hours before session start — cancels after this are "late" */
  lateCancelWindowHours: number;
}

// ─── Social Bonuses (Habitica/Strava: group accountability) ───
export interface SocialBonusConfig {
  /** Consecutive weeks same 3+ people must attend for group streak */
  groupStreakWeeks: number;
  /** FC bonus for each member when group streak triggers */
  groupStreakBonus: number;
  /** FC bonus for N consecutive attended sessions (no no-shows) */
  reliabilityBonus: number;
  /** Sessions needed for reliability bonus */
  reliabilityThreshold: number;
  /** FC bonus for trying N different venues in a month */
  venueVarietyBonus: number;
  /** Venues needed for variety bonus */
  venueVarietyThreshold: number;
}

// ─── Endowed Progress (Nunes & Dreze: pre-filled progress = 2x completion) ───
export interface EndowedProgressConfig {
  /** FC awarded on completing onboarding (first taste, immediate) */
  welcomeBonus: number;
  /** Extra FC on top of sessionComplete for very first session */
  firstSessionBonus: number;
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

  // Gamification systems
  tiers: TierConfig;
  streak: StreakConfig;
  variableRewards: VariableRewardConfig;
  penalties: PenaltyConfig;
  social: SocialBonusConfig;
  endowedProgress: EndowedProgressConfig;
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
  // A6: Extended venue data collection toggles
  collectAmbientNoise: boolean;
  collectLighting: boolean;
  collectTemperature: boolean;
  collectRestroom: boolean;
  collectDeskLayout: boolean;
  collectOutletLocations: boolean;
  collectWallPhotos: boolean;
  collectMenuPhotos: boolean;
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
    dailyEarnCap: 40,
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

    // ─── Tier System ───
    // Based on lifetime FC earned (never demotes on spending).
    // Starbucks model: 1x → 1.15x → 1.3x → 1.5x earn rates.
    // "Explorer" starts day one so nobody feels like a nobody.
    tiers: {
      explorer:  { minLifetimeFC: 0,    earnMultiplier: 1.0,  label: 'Explorer' },
      regular:   { minLifetimeFC: 100,  earnMultiplier: 1.15, label: 'Regular' },
      insider:   { minLifetimeFC: 500,  earnMultiplier: 1.3,  label: 'Insider' },
      champion:  { minLifetimeFC: 1500, earnMultiplier: 1.5,  label: 'Champion' },
    },

    // ─── Streak System ───
    // Weekly cadence (not daily — sessions are weekly rituals).
    // Duolingo data: 7-day streak = 3.6x long-term retention.
    // Streak Freeze reduces churn 21% for at-risk users.
    streak: {
      sessionsPerWeek: 1,
      freezeCost: 15,
      maxFreezes: 2,
      milestones: [4, 8, 12, 26, 52],
      milestoneBonuses: [10, 25, 40, 75, 150],
      multipliers: { 1: 1.0, 4: 1.1, 8: 1.2, 12: 1.3 },
    },

    // ─── Variable Rewards ───
    // Ethical dopamine: unpredictable bonuses tied to real session quality.
    // VR schedules are most resistant to extinction (Skinner).
    // 10% mystery double = enough to be exciting, rare enough to stay surprising.
    variableRewards: {
      mysteryDoubleChance: 0.10,
      groupChemistryBonus: 5,
      goldenSessionMultiplier: 3,
    },

    // ─── Penalties ───
    // Loss aversion coefficient ~2.25x (Kahneman/Tversky).
    // Penalties sting because FC have real redemption value.
    // ClassPass model: no-show = full credit cost + penalty.
    penalties: {
      noShow: 15,
      lateCancel: 10,
      lateCancelWindowHours: 2,
    },

    // ─── Social Bonuses ───
    // Habitica: small-group accountability = 65% higher completion.
    // Strava: club members 2x more likely to exercise weekly.
    // Peloton: cross-discipline engagement = 60% lower churn.
    social: {
      groupStreakWeeks: 3,
      groupStreakBonus: 10,
      reliabilityBonus: 25,
      reliabilityThreshold: 10,
      venueVarietyBonus: 10,
      venueVarietyThreshold: 3,
    },

    // ─── Endowed Progress ───
    // Nunes & Dreze car wash study: pre-filled progress = 2x completion.
    // Starbucks: first redemption at 25 Stars (1-2 visits).
    // Users who feel they've "already started" are dramatically more motivated.
    endowedProgress: {
      welcomeBonus: 25,
      firstSessionBonus: 15,
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
    collectAmbientNoise: true,
    collectLighting: true,
    collectTemperature: true,
    collectRestroom: true,
    collectDeskLayout: true,
    collectOutletLocations: true,
    collectWallPhotos: true,
    collectMenuPhotos: true,
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
