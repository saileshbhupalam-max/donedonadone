/**
 * @module smartIntros
 * @description Generates AI-powered smart intro suggestions for session break phases.
 * Uses calculateMatch() to score group members and produces contextual intro lines
 * and conversation starters based on shared traits, skills, and interests.
 *
 * Key exports:
 * - generateSmartIntros() — Returns top 2 SmartIntro objects for a user's group members
 *
 * Dependencies: matchUtils (calculateMatch), Supabase types (Tables<"profiles">)
 * Related: SmartIntroCard.tsx (renders intros), Session/index.tsx (integration point)
 */
import { Tables } from "@/integrations/supabase/types";
import { calculateMatch } from "@/lib/matchUtils";

type Profile = Tables<"profiles">;

export interface SmartIntro {
  memberId: string;
  memberName: string;
  memberAvatar: string | null;
  matchScore: number;
  introLine: string;
  conversationStarter: string;
  matchReasons: string[];
}

/** Maximum number of intro suggestions to return */
const MAX_INTROS = 2;

/**
 * Build a human-readable intro line based on the strongest match signal.
 * Priority: looking_for/can_offer overlap > same work_vibe > shared interests > neighborhood.
 */
function buildIntroLine(viewer: Profile, member: Profile, reasons: string[]): string {
  const firstName = member.display_name?.split(" ")[0] ?? "them";

  // Check looking_for / can_offer overlap
  const viewerLooking = viewer.looking_for ?? [];
  const memberOffers = member.can_offer ?? [];
  const viewerOffers = viewer.can_offer ?? [];
  const memberLooking = member.looking_for ?? [];

  const theyCanHelp = viewerLooking.filter((t) => memberOffers.includes(t));
  const youCanHelp = viewerOffers.filter((t) => memberLooking.includes(t));

  if (theyCanHelp.length > 0 && youCanHelp.length > 0) {
    return `Talk to ${firstName} \u2014 they can help with ${theyCanHelp[0]} and you can help with ${youCanHelp[0]}`;
  }
  if (theyCanHelp.length > 0) {
    return `Talk to ${firstName} \u2014 they can help with ${theyCanHelp[0]}`;
  }
  if (youCanHelp.length > 0) {
    return `${firstName} is looking for help with ${youCanHelp[0]} \u2014 and you can offer that!`;
  }

  // Same work vibe
  const vibeLabels: Record<string, string> = {
    deep_focus: "deep focus",
    casual_social: "casual & social",
    balanced: "balanced",
  };
  if (viewer.work_vibe && viewer.work_vibe === member.work_vibe) {
    const label = vibeLabels[member.work_vibe] ?? member.work_vibe;
    return `You and ${firstName} both thrive in ${label} mode`;
  }

  // Shared interests
  const viewerInterests = viewer.interests ?? [];
  const memberInterests = member.interests ?? [];
  const shared = viewerInterests.filter((i) => memberInterests.includes(i));
  if (shared.length > 0) {
    const topicsStr = shared.slice(0, 2).join(" and ");
    return `You and ${firstName} both love ${topicsStr}`;
  }

  // Neighborhood match
  if (viewer.neighborhood && viewer.neighborhood === member.neighborhood) {
    return `Neighbors! ${firstName} also works from ${member.neighborhood}`;
  }

  // Fallback using reasons from calculateMatch
  if (reasons.length > 0) {
    return `${firstName} \u2014 ${reasons[0]}`;
  }

  return `Say hi to ${firstName} \u2014 you're in the same session!`;
}

/**
 * Generate a contextual conversation starter based on match signals.
 */
function buildConversationStarter(viewer: Profile, member: Profile): string {
  const firstName = member.display_name?.split(" ")[0] ?? "them";

  // Skill-based starters
  const viewerLooking = viewer.looking_for ?? [];
  const memberOffers = member.can_offer ?? [];
  const theyCanHelp = viewerLooking.filter((t) => memberOffers.includes(t));
  if (theyCanHelp.length > 0) {
    return `"Hey ${firstName}, I noticed you work with ${theyCanHelp[0]}. I've been trying to get into that \u2014 any tips?"`;
  }

  // Interest-based starters
  const viewerInterests = viewer.interests ?? [];
  const memberInterests = member.interests ?? [];
  const shared = viewerInterests.filter((i) => memberInterests.includes(i));
  if (shared.length > 0) {
    return `"${firstName}, do you follow anything cool about ${shared[0]} lately?"`;
  }

  // Vibe-based starters
  if (viewer.work_vibe && viewer.work_vibe === member.work_vibe) {
    const vibeStarters: Record<string, string> = {
      deep_focus: `"What are you deep-diving into today, ${firstName}?"`,
      casual_social: `"Hey ${firstName}, what's been keeping you busy this week?"`,
      balanced: `"${firstName}, how do you balance focus and socializing during sessions?"`,
    };
    return vibeStarters[member.work_vibe ?? ""] ?? `"What are you working on today, ${firstName}?"`;
  }

  // Neighborhood starters
  if (viewer.neighborhood && viewer.neighborhood === member.neighborhood) {
    return `"${firstName}, do you have a favorite cafe in ${member.neighborhood}?"`;
  }

  // What-I-Do based starter
  if (member.what_i_do) {
    return `"${firstName}, I saw you do ${member.what_i_do.split(" ").slice(0, 6).join(" ")}... tell me more!"`;
  }

  // Generic but warm
  return `"Hey ${firstName}, what brought you to DanaDone?"`;
}

/**
 * Generate smart intro suggestions for the current user's group members.
 *
 * @param currentUser - The current user's profile
 * @param groupMembers - Other members in the session group (excluding current user)
 * @returns Top 2 SmartIntro objects sorted by match score (descending)
 */
export function generateSmartIntros(
  currentUser: Profile,
  groupMembers: Profile[],
): SmartIntro[] {
  if (groupMembers.length === 0) return [];

  const intros: SmartIntro[] = groupMembers.map((member) => {
    const { score, reasons } = calculateMatch(currentUser, member);
    const introLine = buildIntroLine(currentUser, member, reasons);
    const conversationStarter = buildConversationStarter(currentUser, member);

    return {
      memberId: member.id,
      memberName: member.display_name ?? "Fellow coworker",
      memberAvatar: member.avatar_url,
      matchScore: score,
      introLine,
      conversationStarter,
      matchReasons: reasons,
    };
  });

  // Sort by score descending, take top N
  intros.sort((a, b) => b.matchScore - a.matchScore);
  return intros.slice(0, MAX_INTROS);
}
