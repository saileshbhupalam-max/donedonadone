/**
 * @module mentorMatch
 * @description Specialized matching for mentor/mentee relationships.
 * Scores mentors against seekers across skill alignment, industry overlap,
 * experience gap, values alignment, neighborhood proximity, and communication style.
 *
 * Key exports:
 * - calculateMentorCompatibility() — Returns {score, reasons} for a seeker-mentor pair (0-100)
 * - fetchMentors() — Queries profiles offering mentorship with taste_graph data
 * - fetchMentees() — Queries profiles seeking mentorship
 * - MENTOR_KEYWORDS / MENTEE_KEYWORDS — Matching keywords for can_offer / looking_for
 * - MENTOR_DOMAINS — Standard domain categories for mentoring
 *
 * Dependencies: Supabase types
 * Related: matchUtils.ts, Discover.tsx, MentorSection.tsx
 */
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type Profile = Tables<"profiles">;
type TasteGraph = Tables<"taste_graph">;

export const MENTOR_KEYWORDS = ["mentorship", "mentoring", "career guidance", "career advice", "coaching"];
export const MENTEE_KEYWORDS = ["mentorship", "mentor", "career guidance", "coaching", "career help"];

export const MENTOR_DOMAINS = [
  "leadership",
  "technical",
  "product",
  "design",
  "fundraising",
  "marketing",
  "career",
  "sales",
  "operations",
  "people management",
  "startup strategy",
  "industry-specific",
] as const;

export type MentorDomain = (typeof MENTOR_DOMAINS)[number];

export interface MentorMatch {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  tagline: string | null;
  mentorScore: number;
  matchReasons: string[];
  canHelpWith: string[];
  domains: string[];
  neighborhood: string | null;
}

/** Check if a profile is offering mentorship */
export function isMentor(profile: Profile): boolean {
  const offers = profile.can_offer ?? [];
  return offers.some((o) => MENTOR_KEYWORDS.includes(o.toLowerCase()));
}

/** Check if a profile is seeking mentorship */
export function isMentee(profile: Profile): boolean {
  const looking = profile.looking_for ?? [];
  return looking.some((l) => MENTEE_KEYWORDS.includes(l.toLowerCase()));
}

export function calculateMentorCompatibility(
  seeker: Profile,
  mentor: Profile,
  seekerTasteGraph?: TasteGraph | null,
  mentorTasteGraph?: TasteGraph | null
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Skill alignment (+30 max): mentor's can_offer matches seeker's looking_for
  const seekerLooking = (seeker.looking_for ?? []).map((s) => s.toLowerCase());
  const mentorOffers = (mentor.can_offer ?? []).map((s) => s.toLowerCase());
  const skillMatches = seekerLooking.filter((s) =>
    mentorOffers.some((o) => o.includes(s) || s.includes(o))
  );
  if (skillMatches.length > 0) {
    score += Math.min(skillMatches.length * 15, 30);
    reasons.push(`Can help with: ${skillMatches.slice(0, 2).join(", ")}`);
  }

  // 2. Industry overlap (+20 max): shared industries from taste_graph
  if (seekerTasteGraph?.industries && mentorTasteGraph?.industries) {
    const seekerIndustries = seekerTasteGraph.industries.map((i) => i.toLowerCase());
    const mentorIndustries = mentorTasteGraph.industries.map((i) => i.toLowerCase());
    const shared = seekerIndustries.filter((i) => mentorIndustries.includes(i));
    if (shared.length > 0) {
      score += Math.min(shared.length * 10, 20);
      reasons.push(`Same industry: ${shared.slice(0, 2).join(", ")}`);
    }
  }

  // 3. Experience gap (+20): mentor has more experience
  if (seekerTasteGraph?.experience_years != null && mentorTasteGraph?.experience_years != null) {
    const gap = mentorTasteGraph.experience_years - seekerTasteGraph.experience_years;
    if (gap >= 5) {
      score += 20;
      reasons.push(`${mentorTasteGraph.experience_years}+ years experience`);
    } else if (gap >= 2) {
      score += 12;
      reasons.push(`More experienced in the field`);
    } else if (gap >= 0) {
      score += 5;
    }
  } else if (mentorTasteGraph?.experience_years && mentorTasteGraph.experience_years >= 5) {
    // If we only know the mentor's experience, give partial credit
    score += 10;
    reasons.push(`${mentorTasteGraph.experience_years}+ years experience`);
  }

  // 4. Values alignment (+15 max): shared values from taste_graph
  if (seekerTasteGraph?.values && mentorTasteGraph?.values) {
    const seekerValues = seekerTasteGraph.values.map((v) => v.toLowerCase());
    const mentorValues = mentorTasteGraph.values.map((v) => v.toLowerCase());
    const sharedValues = seekerValues.filter((v) => mentorValues.includes(v));
    if (sharedValues.length > 0) {
      score += Math.min(sharedValues.length * 5, 15);
      if (sharedValues.length >= 2) {
        reasons.push(`Shared values: ${sharedValues.slice(0, 2).join(", ")}`);
      }
    }
  }

  // 5. Neighborhood proximity (+10): same area for in-person meetings
  if (seeker.neighborhood && mentor.neighborhood && seeker.neighborhood === mentor.neighborhood) {
    score += 10;
    reasons.push(`Both in ${mentor.neighborhood}`);
  }

  // 6. Communication style compatibility (+5)
  if (seeker.communication_style && mentor.communication_style) {
    if (seeker.communication_style === mentor.communication_style) {
      score += 5;
    } else if (
      // Moderate is compatible with everything
      seeker.communication_style === "moderate" ||
      mentor.communication_style === "moderate"
    ) {
      score += 3;
    }
  }

  return { score: Math.min(score, 100), reasons: reasons.slice(0, 4) };
}

interface FetchedMentor {
  profile: Profile;
  tasteGraph: TasteGraph | null;
}

/**
 * Fetch profiles that offer mentorship, along with their taste_graph data.
 * Excludes the current user.
 */
export async function fetchMentors(currentUserId: string): Promise<FetchedMentor[]> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", currentUserId)
    .not("can_offer", "is", null);

  if (!profiles || profiles.length === 0) return [];

  // Filter to mentors client-side (Supabase array overlap is limited)
  const mentorProfiles = profiles.filter((p) => isMentor(p));
  if (mentorProfiles.length === 0) return [];

  const ids = mentorProfiles.map((p) => p.id);
  const { data: tasteGraphs } = await supabase
    .from("taste_graph")
    .select("*")
    .in("user_id", ids);

  const tgMap = new Map((tasteGraphs || []).map((tg) => [tg.user_id, tg]));

  return mentorProfiles.map((p) => ({
    profile: p,
    tasteGraph: tgMap.get(p.id) || null,
  }));
}

/**
 * Fetch profiles that are seeking mentorship.
 * Excludes the current user.
 */
export async function fetchMentees(currentUserId: string): Promise<FetchedMentor[]> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", currentUserId)
    .not("looking_for", "is", null);

  if (!profiles || profiles.length === 0) return [];

  const menteeProfiles = profiles.filter((p) => isMentee(p));
  if (menteeProfiles.length === 0) return [];

  const ids = menteeProfiles.map((p) => p.id);
  const { data: tasteGraphs } = await supabase
    .from("taste_graph")
    .select("*")
    .in("user_id", ids);

  const tgMap = new Map((tasteGraphs || []).map((tg) => [tg.user_id, tg]));

  return menteeProfiles.map((p) => ({
    profile: p,
    tasteGraph: tgMap.get(p.id) || null,
  }));
}

/**
 * Get ranked mentor matches for the current user.
 */
export async function getMentorMatches(
  currentUser: Profile,
  currentUserTasteGraph: TasteGraph | null,
  limit = 10
): Promise<MentorMatch[]> {
  const mentors = await fetchMentors(currentUser.id);

  const matches: MentorMatch[] = mentors.map(({ profile: mentor, tasteGraph }) => {
    const { score, reasons } = calculateMentorCompatibility(
      currentUser,
      mentor,
      currentUserTasteGraph,
      tasteGraph
    );

    // Filter can_offer to relevant mentoring items
    const canHelpWith = (mentor.can_offer ?? []).filter(
      (o) => !MENTOR_KEYWORDS.includes(o.toLowerCase())
    );

    // Get domains from taste_graph skills/industries or interests
    const domains = [
      ...(tasteGraph?.industries ?? []),
      ...(tasteGraph?.skills ?? []).slice(0, 3),
    ].slice(0, 4);

    return {
      profileId: mentor.id,
      displayName: mentor.display_name || "Member",
      avatarUrl: mentor.avatar_url,
      tagline: mentor.tagline,
      mentorScore: score,
      matchReasons: reasons,
      canHelpWith: canHelpWith.slice(0, 5),
      domains,
      neighborhood: mentor.neighborhood,
    };
  });

  return matches.sort((a, b) => b.mentorScore - a.mentorScore).slice(0, limit);
}
