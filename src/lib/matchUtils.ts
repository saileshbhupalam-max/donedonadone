/**
 * @module matchUtils
 * @description User compatibility scoring and profile completion calculation.
 * Match scoring considers: work vibe (20pts), neighborhood (15pts), looking_for/can_offer overlap (15pts each),
 * shared interests (5pts each), noise preference (5pts), communication style (5pts). Score capped at 100.
 *
 * Key exports:
 * - calculateMatch() — Returns {score, reasons} comparing two profiles (0-100 scale, up to 4 reason strings)
 * - calculateProfileCompletion() — Returns 0-100 percentage based on filled profile fields
 *
 * Dependencies: Supabase types (Tables<"profiles">)
 * Related: Discover.tsx (displays match scores), MemberCard.tsx (shows match reasons), personality.ts (empty state copy)
 */
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export function calculateMatch(viewer: Profile, member: Profile): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const vibeLabels: Record<string, string> = {
    "deep_focus": "Deep Focus",
    "casual_social": "Casual Social",
    "balanced": "Balanced",
  };

  if (viewer.work_vibe && viewer.work_vibe === member.work_vibe) {
    score += 20;
    reasons.push(`Same work vibe: ${vibeLabels[member.work_vibe] ?? member.work_vibe}`);
  }
  if (viewer.neighborhood && viewer.neighborhood === member.neighborhood) {
    score += 15;
    reasons.push(`Both in ${member.neighborhood}`);
  }
  if (viewer.noise_preference && viewer.noise_preference === member.noise_preference) {
    score += 5;
  }
  if (viewer.communication_style && viewer.communication_style === member.communication_style) {
    score += 5;
  }

  const viewerLooking = viewer.looking_for ?? [];
  const memberOffers = member.can_offer ?? [];
  const viewerOffers = viewer.can_offer ?? [];
  const memberLooking = member.looking_for ?? [];

  const lookingMatchOffers = viewerLooking.filter(t => memberOffers.includes(t));
  score += lookingMatchOffers.length * 15;
  lookingMatchOffers.slice(0, 2).forEach(t => {
    reasons.push(`They offer ${t} (you're looking for it!)`);
  });

  const offersMatchLooking = viewerOffers.filter(t => memberLooking.includes(t));
  score += offersMatchLooking.length * 10;
  offersMatchLooking.slice(0, 2).forEach(t => {
    reasons.push(`You're both looking for ${t}`);
  });

  const viewerInterests = viewer.interests ?? [];
  const memberInterests = member.interests ?? [];
  const sharedInterests = viewerInterests.filter(i => memberInterests.includes(i));
  score += sharedInterests.length * 5;
  if (sharedInterests.length > 0) {
    reasons.push(`Shared interests: ${sharedInterests.slice(0, 3).join(", ")}`);
  }

  return { score: Math.min(score, 100), reasons: reasons.slice(0, 4) };
}

export function calculateProfileCompletion(p: Profile): number {
  let pct = 0;
  if (p.display_name) pct += 10;
  if (p.avatar_url) pct += 10;
  if (p.tagline) pct += 10;
  if (p.what_i_do) pct += 15;
  if ((p.looking_for ?? []).length > 0) pct += 10;
  if ((p.can_offer ?? []).length > 0) pct += 10;
  if (p.work_vibe) pct += 5;
  if (p.linkedin_url || p.instagram_handle || p.twitter_handle) pct += 10;
  if ((p.interests ?? []).length > 0) pct += 10;
  if (p.gender) pct += 5;
  if (p.neighborhood) pct += 5;
  return pct;
}
