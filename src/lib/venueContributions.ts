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
  | 'suggest_venue'
  // A6: Exhaustive venue data types
  | 'wall_photo'
  | 'ambient_noise'
  | 'lighting'
  | 'temperature'
  | 'restroom'
  | 'desk_layout'
  | 'outlet_locations'
  | 'menu_photo';

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
  // A6: Extended venue data fields
  ambient_noise_db?: number;
  lighting_type?: 'natural' | 'warm' | 'cool' | 'dim' | 'bright';
  temperature_comfort?: 'too_cold' | 'comfortable' | 'too_warm';
  restroom_rating?: 1 | 2 | 3 | 4 | 5;
  desk_type?: 'individual' | 'shared_long' | 'round' | 'standing' | 'mixed';
  outlet_count?: 'none' | 'few' | 'most_seats' | 'every_seat';
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
  // A6: Extended data completeness
  ambientNoise: boolean;
  lighting: boolean;
  temperature: boolean;
  restroom: boolean;
  deskLayout: boolean;
  outletLocations: boolean;
  menuPhotos: number;
  wallPhotos: number;
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
  // A6: Extended venue data — photos use upload_photo, reports use report_venue_info
  wall_photo: { action: 'upload_photo', configKey: 'uploadPhoto' },
  ambient_noise: { action: 'report_venue_info', configKey: 'reportVenueInfo' },
  lighting: { action: 'report_venue_info', configKey: 'reportVenueInfo' },
  temperature: { action: 'report_venue_info', configKey: 'reportVenueInfo' },
  restroom: { action: 'report_venue_info', configKey: 'reportVenueInfo' },
  desk_layout: { action: 'report_venue_info', configKey: 'reportVenueInfo' },
  outlet_locations: { action: 'report_venue_info', configKey: 'reportVenueInfo' },
  menu_photo: { action: 'upload_photo', configKey: 'uploadPhoto' },
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

/** First-mover bonus multiplier — awarded when no prior contribution of this type exists for a venue */
const FIRST_MOVER_BONUS = 2;

/**
 * Submit a venue contribution. Records it in venue_contributions and
 * awards Focus Credits (subject to quality gates and diminishing returns).
 * First contributions of a type for a venue receive a 2x FC bonus.
 */
export async function submitVenueContribution(
  userId: string,
  venueId: string | null,
  type: ContributionType,
  data: ContributionData
): Promise<{ success: boolean; creditsAwarded: number; isFirstMover: boolean; reason?: string }> {
  // Quality gate check
  const gate = passesQualityGate(type, data);
  if (!gate.pass) {
    return { success: false, creditsAwarded: 0, isFirstMover: false, reason: gate.reason };
  }

  const mapping = CONTRIBUTION_CREDIT_MAP[type];
  const config = getGrowthConfig().credits;
  let baseAmount = (config as any)[mapping.configKey] as number;

  // A8: First-mover bonus — check if anyone has contributed this type for this venue
  let isFirstMover = false;
  if (venueId) {
    const { data: existing } = await supabase
      .from('venue_contributions')
      .select('id')
      .eq('venue_id', venueId)
      .eq('contribution_type', type)
      .limit(1);

    if (!existing || existing.length === 0) {
      isFirstMover = true;
      baseAmount *= FIRST_MOVER_BONUS;
    }
  }

  // Award credits (enforces caps/diminishing returns)
  const creditResult = await awardCredits(userId, mapping.action, baseAmount, {
    venue_id: venueId ?? undefined,
    first_mover: isFirstMover || undefined,
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
    return { success: false, creditsAwarded: 0, isFirstMover, reason: error.message };
  }

  return { success: true, creditsAwarded: creditResult.awarded, isFirstMover };
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
  const wallPhotoCount = (data || []).filter((d: any) => d.contribution_type === 'wall_photo').length;
  const menuPhotoCount = (data || []).filter((d: any) => d.contribution_type === 'menu_photo').length;

  const checks = {
    noise: types.has('noise_report'),
    wifi: types.has('wifi_report'),
    seating: types.has('seating_report'),
    photos: photoCount,
    companyPresence: types.has('company_presence'),
    floorCount: types.has('floor_count'),
    amenities: types.has('amenities'),
    powerOutlets: types.has('amenities') || types.has('outlet_locations'),
    parking: types.has('parking'),
    foodOptions: types.has('food_options'),
    ambientNoise: types.has('ambient_noise'),
    lighting: types.has('lighting'),
    temperature: types.has('temperature'),
    restroom: types.has('restroom'),
    deskLayout: types.has('desk_layout'),
    outletLocations: types.has('outlet_locations'),
    menuPhotos: menuPhotoCount,
    wallPhotos: wallPhotoCount,
  };

  // Calculate overall completeness (photos count as complete if >= 1)
  const categories = [
    checks.noise, checks.wifi, checks.seating, photoCount > 0,
    checks.companyPresence, checks.floorCount, checks.amenities,
    checks.parking, checks.foodOptions,
    checks.ambientNoise, checks.lighting, checks.temperature,
    checks.restroom, checks.deskLayout, checks.outletLocations,
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
