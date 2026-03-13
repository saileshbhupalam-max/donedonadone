/**
 * @module matchNudges
 * @description Generates proactive, contextual match nudges for the Home feed.
 * Nudge types (priority order): new_member > session_buddy > skill_swap > neighbor > interest_twin.
 * Filters out already-connected users, dismissed nudges, and low-score matches (<40).
 *
 * Key exports:
 * - generateMatchNudges() — Returns prioritised MatchNudge[] for display
 * - MatchNudge — Interface for a single nudge
 * - dismissNudge() / getDismissedNudgeIds() — localStorage persistence for dismissals
 *
 * Dependencies: Supabase client, matchUtils (calculateMatch), Supabase types
 * Related: MatchNudgeCard.tsx (display), Home/index.tsx (consumer), growth.ts (analytics)
 */
import { supabase } from "@/integrations/supabase/client";
import { calculateMatch } from "@/lib/matchUtils";
import { Tables } from "@/integrations/supabase/types";
import { subDays } from "date-fns";

type Profile = Tables<"profiles">;

export type NudgeType = "new_member" | "session_buddy" | "skill_swap" | "neighbor" | "interest_twin";

export interface MatchNudge {
  id: string;
  type: NudgeType;
  profile: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    tagline: string | null;
  };
  matchScore: number;
  headline: string;
  reason: string;
  actionLabel: string;
  actionLink: string;
  priority: number;
}

const DISMISSED_KEY = "fc_dismissed_nudges";
const PRIORITY_MAP: Record<NudgeType, number> = {
  new_member: 5,
  session_buddy: 4,
  skill_swap: 3,
  neighbor: 2,
  interest_twin: 1,
};

// --- Dismissal helpers ---

export function getDismissedNudgeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function dismissNudge(nudgeId: string): void {
  const dismissed = getDismissedNudgeIds();
  dismissed.add(nudgeId);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
}

// --- Nudge generation ---

function makeNudgeId(type: NudgeType, memberId: string): string {
  return `${type}:${memberId}`;
}

function getFirstName(name: string | null): string {
  return name?.split(" ")[0] || "Someone";
}

/**
 * Determine the best nudge type for a member based on available signals.
 * Returns null if no strong signal found.
 */
function classifyNudge(
  viewer: Profile,
  member: Profile,
  matchResult: { score: number; reasons: string[] },
  recentMemberIds: Set<string>,
  sessionBuddyIds: Set<string>,
  sessionBuddyEventTitle: Map<string, string>
): { type: NudgeType; headline: string; reason: string } | null {
  const firstName = getFirstName(member.display_name);

  // 1. New member match
  if (recentMemberIds.has(member.id) && matchResult.score >= 40) {
    const whatTheyDo = member.what_i_do || member.tagline || "a fellow focused worker";
    return {
      type: "new_member",
      headline: `New member! ${firstName} just joined`,
      reason: `${firstName} is ${whatTheyDo}. Match score: ${matchResult.score}%. ${matchResult.reasons[0] || ""}`.trim(),
    };
  }

  // 2. Session buddy
  if (sessionBuddyIds.has(member.id)) {
    const eventTitle = sessionBuddyEventTitle.get(member.id) || "an upcoming session";
    return {
      type: "session_buddy",
      headline: `Session buddy: You're both going to ${eventTitle}`,
      reason: `You and ${firstName} are attending the same session. Say hi! Match score: ${matchResult.score}%.`,
    };
  }

  // 3. Skill swap (strong looking_for/can_offer complementarity)
  const viewerLooking = viewer.looking_for ?? [];
  const memberOffers = member.can_offer ?? [];
  const viewerOffers = viewer.can_offer ?? [];
  const memberLooking = member.looking_for ?? [];
  const theyOfferYouNeed = viewerLooking.filter((t) => memberOffers.includes(t));
  const youOfferTheyNeed = viewerOffers.filter((t) => memberLooking.includes(t));

  if (theyOfferYouNeed.length > 0 && youOfferTheyNeed.length > 0) {
    return {
      type: "skill_swap",
      headline: `Skill swap with ${firstName}`,
      reason: `${firstName} can help with ${theyOfferYouNeed[0]}, and you can help with ${youOfferTheyNeed[0]}.`,
    };
  }

  // 4. Neighbor (same neighborhood + compatible work vibe)
  if (
    viewer.neighborhood &&
    member.neighborhood &&
    viewer.neighborhood === member.neighborhood &&
    matchResult.score >= 40
  ) {
    const vibeLabels: Record<string, string> = {
      deep_focus: "deep focus",
      casual_social: "casual social",
      balanced: "balanced",
    };
    const vibeText = member.work_vibe ? ` and loves ${vibeLabels[member.work_vibe] || member.work_vibe} mode` : "";
    return {
      type: "neighbor",
      headline: `Neighbor: ${firstName} also works from ${member.neighborhood}`,
      reason: `${firstName} is in your area${vibeText}. Match score: ${matchResult.score}%.`,
    };
  }

  // 5. Interest twin (3+ shared interests)
  const viewerInterests = viewer.interests ?? [];
  const memberInterests = member.interests ?? [];
  const shared = viewerInterests.filter((i) => memberInterests.includes(i));

  if (shared.length >= 3) {
    return {
      type: "interest_twin",
      headline: `Interest twin: ${firstName} shares ${shared.length} of your interests`,
      reason: `You both love ${shared.slice(0, 3).join(", ")}. Lots to talk about!`,
    };
  }

  // No strong signal — skip if score < 50 for generic matches
  if (matchResult.score >= 50 && theyOfferYouNeed.length > 0) {
    return {
      type: "skill_swap",
      headline: `${firstName} can help with ${theyOfferYouNeed[0]}`,
      reason: `${firstName} offers ${theyOfferYouNeed[0]} which you're looking for. Match score: ${matchResult.score}%.`,
    };
  }

  return null;
}

export async function generateMatchNudges(
  userId: string,
  userProfile: Profile,
  allProfiles: Profile[],
  limit: number = 3
): Promise<MatchNudge[]> {
  const dismissed = getDismissedNudgeIds();
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = subDays(new Date(), 7).toISOString();

  // Parallel fetches for session buddies and connections
  const [rsvpRes, connectionRes] = await Promise.all([
    // Get user's upcoming RSVPs + all RSVPs for those events
    supabase
      .from("event_rsvps")
      .select("event_id, user_id, events!inner(id, title, date)")
      .eq("status", "going")
      .gte("events.date", today),

    // Get existing connections (both directions)
    supabase
      .from("connection_requests")
      .select("from_user, to_user, status")
      .or(`from_user.eq.${userId},to_user.eq.${userId}`)
      .in("status", ["pending", "accepted"]),
  ]);

  // Build connected user set
  const connectedIds = new Set<string>();
  for (const conn of connectionRes.data ?? []) {
    if (conn.from_user === userId) connectedIds.add(conn.to_user);
    if (conn.to_user === userId) connectedIds.add(conn.from_user);
  }

  // Build session buddy set: other users going to same events as current user
  const sessionBuddyIds = new Set<string>();
  const sessionBuddyEventTitle = new Map<string, string>();
  const allRsvps = rsvpRes.data ?? [];
  const userEventIds = new Set(
    allRsvps.filter((r: any) => r.user_id === userId).map((r: any) => r.event_id)
  );
  for (const rsvp of allRsvps) {
    const r = rsvp as any;
    if (r.user_id !== userId && userEventIds.has(r.event_id)) {
      sessionBuddyIds.add(r.user_id);
      if (r.events?.title) {
        sessionBuddyEventTitle.set(r.user_id, r.events.title);
      }
    }
  }

  // Recent members (joined in last 7 days)
  const recentMemberIds = new Set(
    allProfiles
      .filter((p) => p.id !== userId && p.created_at && p.created_at >= sevenDaysAgo)
      .map((p) => p.id)
  );

  // Score and classify each member
  const nudges: MatchNudge[] = [];

  for (const member of allProfiles) {
    if (member.id === userId) continue;

    const matchResult = calculateMatch(userProfile, member);
    if (matchResult.score < 40) continue;

    const nudgeId = makeNudgeId("new_member", member.id); // Will be overridden
    const classification = classifyNudge(
      userProfile,
      member,
      matchResult,
      recentMemberIds,
      sessionBuddyIds,
      sessionBuddyEventTitle
    );

    if (!classification) continue;

    const actualId = makeNudgeId(classification.type, member.id);
    if (dismissed.has(actualId)) continue;

    // Check connection status for button label
    const isConnected = connectedIds.has(member.id);

    nudges.push({
      id: actualId,
      type: classification.type,
      profile: {
        id: member.id,
        displayName: member.display_name || "FocusClub Member",
        avatarUrl: member.avatar_url,
        tagline: member.tagline,
      },
      matchScore: matchResult.score,
      headline: classification.headline,
      reason: classification.reason,
      actionLabel: isConnected ? "Already Connected" : "Connect",
      actionLink: `/profile/${member.id}`,
      priority: PRIORITY_MAP[classification.type],
    });
  }

  // Sort by priority (desc), then score (desc)
  nudges.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.matchScore - a.matchScore;
  });

  return nudges.slice(0, limit);
}
