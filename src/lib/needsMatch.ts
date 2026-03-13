/**
 * @module needsMatch
 * @description Scoring engine for matching community needs/offers with user profiles.
 * Considers category-to-profile mapping, description keyword matching, neighborhood proximity,
 * and user engagement level.
 *
 * Key exports:
 * - scoreNeedForUser() — Returns {needId, matchScore, matchReasons} for a need against a user profile
 * - parseNeedMeta() — Extracts embedded metadata from a micro_request description
 * - serializeNeedMeta() — Embeds metadata into a description string
 *
 * Dependencies: Supabase types (Tables<"profiles">, Tables<"taste_graph">)
 * Related: Needs.tsx (Needs Board page), NeedsMatchCard.tsx (home card)
 */
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type TasteGraph = Tables<"taste_graph">;

const META_SEPARATOR = "\n---meta---\n";

export interface NeedMeta {
  budget?: string;
  duration?: string;
  skills?: string[];
  is_offer?: boolean;
  company_id?: string;
}

export interface NeedMatch {
  needId: string;
  matchScore: number;
  matchReasons: string[];
}

/**
 * Parse embedded metadata from a micro_request description.
 * Format: {visible description}\n---meta---\n{json}
 */
export function parseNeedMeta(description: string | null): { text: string; meta: NeedMeta } {
  if (!description) return { text: "", meta: {} };
  const idx = description.indexOf(META_SEPARATOR);
  if (idx === -1) return { text: description, meta: {} };
  const text = description.slice(0, idx);
  try {
    const meta = JSON.parse(description.slice(idx + META_SEPARATOR.length)) as NeedMeta;
    return { text, meta };
  } catch {
    return { text: description, meta: {} };
  }
}

/**
 * Serialize a description + metadata into the storage format.
 */
export function serializeNeedMeta(text: string, meta: NeedMeta): string {
  const hasAnyMeta = meta.budget || meta.duration || (meta.skills && meta.skills.length > 0) ||
    meta.is_offer !== undefined || meta.company_id;
  if (!hasAnyMeta) return text;
  return `${text}${META_SEPARATOR}${JSON.stringify(meta)}`;
}

/**
 * Determine if a micro_request is an "offer" vs a "need".
 * Uses the embedded metadata is_offer flag, or falls back to title prefix convention.
 */
export function isOffer(title: string, description: string | null): boolean {
  const { meta } = parseNeedMeta(description);
  if (meta.is_offer !== undefined) return meta.is_offer;
  return title.startsWith("[OFFER]");
}

// Normalize text for keyword matching
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// Category labels for display
export const NEED_CATEGORIES: Record<string, { label: string; icon: string }> = {
  skill_help: { label: "Skill Help", icon: "wrench" },
  coffee_chat: { label: "Coffee Chat", icon: "coffee" },
  feedback: { label: "Feedback", icon: "message-square" },
  collaboration: { label: "Collaboration", icon: "handshake" },
  hiring: { label: "Hiring", icon: "briefcase" },
  freelance: { label: "Freelance", icon: "laptop" },
  other: { label: "Other", icon: "sparkles" },
};

export const BUDGET_OPTIONS = [
  { value: "under_5k", label: "Under 5K" },
  { value: "5k_25k", label: "5K-25K" },
  { value: "25k_1l", label: "25K-1L" },
  { value: "1l_plus", label: "1L+" },
  { value: "equity_barter", label: "Equity/Barter" },
];

export const DURATION_OPTIONS = [
  { value: "one_time", label: "One-time" },
  { value: "1_2_weeks", label: "1-2 weeks" },
  { value: "1_month", label: "1 month" },
  { value: "ongoing", label: "Ongoing" },
];

/**
 * Score how well a need matches a user's profile.
 *
 * Scoring breakdown (max 100):
 * - Category to profile match: +40
 * - Description keyword match: +30
 * - Neighborhood proximity: +15
 * - Active engagement: +15
 */
export function scoreNeedForUser(
  need: {
    id: string;
    title: string;
    description: string | null;
    request_type: string;
    user_id: string;
  },
  userProfile: Profile,
  userTasteGraph?: TasteGraph | null
): NeedMatch {
  // Don't match user's own needs
  if (need.user_id === userProfile.id) {
    return { needId: need.id, matchScore: 0, matchReasons: [] };
  }

  let score = 0;
  const reasons: string[] = [];
  const { text, meta } = parseNeedMeta(need.description);

  const userSkills = [
    ...(userProfile.can_offer ?? []),
    ...(userTasteGraph?.skills ?? []),
    ...(userTasteGraph?.work_can_offer ?? []),
  ].map(s => s.toLowerCase());

  const userInterests = [
    ...(userProfile.interests ?? []),
    ...(userProfile.looking_for ?? []),
    ...(userTasteGraph?.work_looking_for ?? []),
    ...(userTasteGraph?.industries ?? []),
    ...(userTasteGraph?.topics ?? []),
  ].map(s => s.toLowerCase());

  const allUserTokens = [...userSkills, ...userInterests];

  // --- Category to Profile Match (up to +40) ---
  const type = need.request_type;
  const metaSkills = (meta.skills ?? []).map(s => s.toLowerCase());

  if (type === "hiring" || type === "freelance") {
    // Check if user has relevant skills from taste_graph or can_offer
    const matchedSkills = metaSkills.filter(s => userSkills.includes(s));
    if (matchedSkills.length > 0) {
      score += 40;
      reasons.push(`Matches your skills: ${matchedSkills.slice(0, 3).join(", ")}`);
    } else if (userTasteGraph?.role_type) {
      // Fuzzy: check if the description mentions their role
      const roleTokens = tokenize(userTasteGraph.role_type);
      const descTokens = tokenize(`${need.title} ${text}`);
      if (roleTokens.some(r => descTokens.includes(r))) {
        score += 25;
        reasons.push(`Related to your role: ${userTasteGraph.role_type}`);
      }
    }
  } else if (type === "skill_help") {
    const matchedOffers = metaSkills.filter(s => userSkills.includes(s));
    if (matchedOffers.length > 0) {
      score += 40;
      reasons.push(`You can offer: ${matchedOffers.slice(0, 3).join(", ")}`);
    }
  } else if (type === "collaboration") {
    const matchedInterests = metaSkills.filter(s =>
      userInterests.includes(s) || userSkills.includes(s)
    );
    if (matchedInterests.length > 0) {
      score += 35;
      reasons.push(`Shared interest: ${matchedInterests.slice(0, 2).join(", ")}`);
    } else if (userTasteGraph?.industries) {
      const industryTokens = userTasteGraph.industries.map(i => i.toLowerCase());
      const descTokens = tokenize(`${need.title} ${text}`);
      if (industryTokens.some(i => descTokens.includes(i))) {
        score += 20;
        reasons.push("Related to your industry");
      }
    }
  } else if (type === "coffee_chat") {
    // Neighborhood + shared interests boost
    if (userProfile.neighborhood) {
      const descLower = `${need.title} ${text}`.toLowerCase();
      if (descLower.includes(userProfile.neighborhood.toLowerCase())) {
        score += 20;
        reasons.push(`In your neighborhood: ${userProfile.neighborhood}`);
      }
    }
    score += 15; // Coffee chats are broadly relevant
    if (reasons.length === 0) reasons.push("Open to connecting");
  } else if (type === "feedback") {
    // Check if user has expertise in the area
    const descTokens = tokenize(`${need.title} ${text}`);
    const matchedExpertise = allUserTokens.filter(s => descTokens.includes(s));
    if (matchedExpertise.length > 0) {
      score += 35;
      reasons.push(`You have expertise in: ${matchedExpertise.slice(0, 2).join(", ")}`);
    }
  }

  // --- Description keyword match (up to +30) ---
  if (text) {
    const descTokens = new Set(tokenize(`${need.title} ${text}`));
    const keywordMatches = allUserTokens.filter(t => descTokens.has(t));
    const uniqueMatches = [...new Set(keywordMatches)];
    if (uniqueMatches.length > 0) {
      const keywordScore = Math.min(uniqueMatches.length * 10, 30);
      score += keywordScore;
      if (reasons.length === 0) {
        reasons.push(`Keywords match: ${uniqueMatches.slice(0, 3).join(", ")}`);
      }
    }
  }

  // --- Neighborhood proximity (+15) ---
  // Already partially handled for coffee_chat; general check here
  if (type !== "coffee_chat" && userProfile.neighborhood) {
    // We don't have poster's neighborhood directly, but check description
    const descLower = `${need.title} ${text}`.toLowerCase();
    if (descLower.includes(userProfile.neighborhood.toLowerCase())) {
      score += 15;
      reasons.push(`Near ${userProfile.neighborhood}`);
    }
  }

  // --- Active engagement (+15) ---
  const attended = userProfile.events_attended ?? 0;
  if (attended >= 5) {
    score += 15;
  } else if (attended >= 2) {
    score += 8;
  } else if (attended >= 1) {
    score += 3;
  }

  return {
    needId: need.id,
    matchScore: Math.min(score, 100),
    matchReasons: reasons.slice(0, 4),
  };
}
