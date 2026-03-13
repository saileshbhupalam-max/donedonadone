/**
 * @module venueContributions
 * @description Venue data collection engine. Handles user contributions (photos, reviews,
 * venue info reports) and awards Focus Credits for each.
 *
 * Key exports:
 * - submitVenueContribution() — Record contribution and award FC
 * - getContributionStats() — User's total contributions and FC earned
 * - getVenueDataCompleteness() — Per-category data completeness for a venue
 * - checkContributionMilestone() — Check if user hit premium-days milestone
 *
 * Dependencies: Supabase client, focusCredits, growthConfig
 * Tables: venue_contributions, focus_credits
 */
import { supabase } from "@/integrations/supabase/client";
import { awardCredits } from "@/lib/focusCredits";
import { getGrowthConfig } from "@/lib/growthConfig";
import type { CreditAction, CreditMetadata } from "@/lib/focusCredits";

// ─── Types ──────────────────────────────────

export type ContributionType =
  | 'photo'
  | 'review'
  | 'noise_report'
  | 'wifi_report'
  | 'seating_report'
  | 'company_presence'
  | 'floor_count'
  | 'amenities'
  | 'parking'
  | 'food_options'
  | 'verify_info'
  | 'suggest_venue';

export interface ContributionData {
  rating?: number;
  photo_url?: string;
  review?: string;
  wifi_speed?: string;
  noise_level?: string;
  seating_count?: number;
  floor_count?: number;
  amenities?: string[];
  company_name?: string;
  parking_type?: string;
  food_options?: string[];
  [key: string]: unknown;
}

export interface ContributionStats {
  totalContributions: number;
  totalCreditsEarned: number;
  byType: Record<string, number>;
}

export interface VenueCompleteness {
  noise: boolean;
  wifi: boolean;
  seating: boolean;
  photos: number;
  companyPresence: boolean;
  floorCount: boolean;
  amenities: boolean;
  powerOutlets: boolean;
  parking: boolean;
  foodOptions: boolean;
  overallPercent: number;
}

// ─── Credit Action Mapping ──────────────────────────────

const CONTRIBUTION_CREDIT_MAP: Record<ContributionType, { action: CreditAction; configKey: string }> = {
  photo: { action: 'upload_photo', configKey: 'uploadPhoto' },
  review: { action: 'write_review', configKey: 'writeReview' },
  noise_report: { action: 'report_venue_info', configKey: 'reportVenueInfo' },
  wifi_report: { action: 'report_venue_info', configKey: 'reportVenueInfo' },
  seating_report: { action: 'report_seating_capacity', configKey: 'reportSeatingCapacity' },
  company_presence: { action: 'report_company_presence', configKey: 'reportCompanyPresence' },
  floor_count: { action: 'report_floor_count', configKey: 'reportFloorCount' },
  amenities: { action: 'report_amenities', configKey: 'reportAmenities' },
  parking: { action: 'report_venue_info', configKey: 'reportVenueInfo' },
  food_options: { action: 'report_venue_info', configKey: 'reportVenueInfo' },
  verify_info: { action: 'verify_venue_info', configKey: 'verifyVenueInfo' },
  suggest_venue: { action: 'add_new_venue', configKey: 'addNewVenue' },
};

// ─── Quality Gate Checks ──────────────────────────────

function passesQualityGate(type: ContributionType, data: ContributionData): { pass: boolean; reason?: string } {
  const gates = getGrowthConfig().credits.qualityGates;

  if (type === 'review') {
    const reviewText = data.review || '';
    if (reviewText.length < gates.minReviewLength) {
      return { pass: false, reason: `Review must be at least ${gates.minReviewLength} characters` };
    }
  }

  if (type === 'photo') {
    const sizeKB = (data as any).photo_size_kb ?? 0;
    if (sizeKB > 0 && sizeKB < gates.minPhotoSizeKB) {
      return { pass: false, reason: `Photo must be at least ${gates.minPhotoSizeKB}KB` };
    }
  }

  return { pass: true };
}

// ─── Core Functions ──────────────────────────────────

/**
 * Submit a venue contribution. Records it in venue_contributions and
 * awards Focus Credits (subject to quality gates and diminishing returns).
 */
export async function submitVenueContribution(
  userId: string,
  venueId: string | null,
  type: ContributionType,
  data: ContributionData
): Promise<{ success: boolean; creditsAwarded: number; reason?: string }> {
  // Quality gate check
  const gate = passesQualityGate(type, data);
  if (!gate.pass) {
    return { success: false, creditsAwarded: 0, reason: gate.reason };
  }

  const mapping = CONTRIBUTION_CREDIT_MAP[type];
  const config = getGrowthConfig().credits;
  const baseAmount = (config as any)[mapping.configKey] as number;

  // Award credits first (enforces caps/diminishing returns)
  const creditResult = await awardCredits(userId, mapping.action, baseAmount, {
    venue_id: venueId ?? undefined,
  } as CreditMetadata);

  // Record the contribution regardless of credit outcome
  const { error } = await supabase
    .from('venue_contributions')
    .insert({
      user_id: userId,
      venue_id: venueId,
      contribution_type: type,
      data,
      credits_awarded: creditResult.awarded,
      verified: false,
    });

  if (error) {
    return { success: false, creditsAwarded: 0, reason: error.message };
  }

  return { success: true, creditsAwarded: creditResult.awarded };
}

/**
 * Get contribution stats for a user: total count, credits earned, breakdown by type.
 */
export async function getContributionStats(userId: string): Promise<ContributionStats> {
  const { data, error } = await supabase
    .from('venue_contributions')
    .select('contribution_type, credits_awarded')
    .eq('user_id', userId);

  if (error || !data) {
    return { totalContributions: 0, totalCreditsEarned: 0, byType: {} };
  }

  const entries = data as Array<{ contribution_type: string; credits_awarded: number }>;
  const byType: Record<string, number> = {};
  let totalCreditsEarned = 0;

  for (const entry of entries) {
    byType[entry.contribution_type] = (byType[entry.contribution_type] || 0) + 1;
    totalCreditsEarned += entry.credits_awarded;
  }

  return {
    totalContributions: entries.length,
    totalCreditsEarned,
    byType,
  };
}

/**
 * Get data completeness for a venue. Returns which data categories have
 * been contributed and an overall percentage.
 */
export async function getVenueDataCompleteness(venueId: string): Promise<VenueCompleteness> {
  const { data, error } = await supabase
    .from('venue_contributions')
    .select('contribution_type')
    .eq('venue_id', venueId);

  const types = new Set((data || []).map((d: any) => d.contribution_type));
  const photoCount = (data || []).filter((d: any) => d.contribution_type === 'photo').length;

  const checks = {
    noise: types.has('noise_report'),
    wifi: types.has('wifi_report'),
    seating: types.has('seating_report'),
    photos: photoCount,
    companyPresence: types.has('company_presence'),
    floorCount: types.has('floor_count'),
    amenities: types.has('amenities'),
    powerOutlets: types.has('amenities'), // included in amenities
    parking: types.has('parking'),
    foodOptions: types.has('food_options'),
  };

  // Calculate overall completeness (photos count as complete if >= 1)
  const categories = [
    checks.noise, checks.wifi, checks.seating, photoCount > 0,
    checks.companyPresence, checks.floorCount, checks.amenities,
    checks.parking, checks.foodOptions,
  ];
  const completed = categories.filter(Boolean).length;
  const overallPercent = Math.round((completed / categories.length) * 100);

  return { ...checks, overallPercent };
}

/**
 * Check if the user has hit the contribution milestone for premium days reward.
 * Returns true if the milestone was just reached (not previously awarded).
 */
export async function checkContributionMilestone(userId: string): Promise<boolean> {
  const config = getGrowthConfig().growth;
  const threshold = config.contributionMilestoneActions;

  // Count recent contributions (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recent } = await supabase
    .from('venue_contributions')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  const count = recent?.length ?? 0;
  if (count < threshold) return false;

  // Check if milestone already awarded in this period
  const { data: existing } = await supabase
    .from('focus_credits')
    .select('id')
    .eq('user_id', userId)
    .eq('action', 'contribution_milestone' as any)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .limit(1);

  if (existing && existing.length > 0) return false;

  // Award milestone (recorded as a credit entry for tracking)
  await supabase
    .from('focus_credits')
    .insert({
      user_id: userId,
      amount: 0,
      action: 'contribution_milestone',
      metadata: { premium_days: config.premiumDaysForContributions, contributions: count },
      expires_at: null,
    });

  return true;
}
