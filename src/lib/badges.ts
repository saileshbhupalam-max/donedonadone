/**
 * @module badges
 * @description 17 badge definitions with eligibility checking and auto-award system.
 * Badges cover: early adopter, profile completion, prompts, events, social links, reactions, referrals, and peer props.
 *
 * Key exports:
 * - BADGE_DEFINITIONS — Array of 17 badge types with emoji, name, description, hint
 * - getBadgeDef() — Look up a badge definition by type string
 * - fetchBadgeStats() — Fetch all stats needed for badge eligibility from Supabase
 * - checkAndAwardBadges() — Check eligibility and award new badges via Supabase RPCs, sending notifications
 *
 * Dependencies: Supabase client (queries prompt_responses, event_rsvps, peer_props, member_badges; RPCs award_badge, create_system_notification)
 * Related: Profile.tsx (displays badges), AchievementsSection.tsx (renders badge grid), growth.ts (milestones, separate system)
 */
import { parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export interface BadgeDef {
  type: string;
  emoji: string;
  name: string;
  description: string;
  hint: string;
}

export const BADGE_DEFINITIONS: BadgeDef[] = [
  { type: "early_adopter", emoji: "🌱", name: "Early Adopter", description: "Joined FocusClub early", hint: "Join within the first 30 days" },
  { type: "complete_profile", emoji: "✅", name: "Complete Profile", description: "Filled out everything", hint: "Reach 100% profile completion" },
  { type: "first_prompt", emoji: "💬", name: "First Prompt", description: "Answered your first prompt", hint: "Answer a community prompt" },
  { type: "prompt_streak_3", emoji: "🔥", name: "Prompt Streak", description: "Answered 3 prompts", hint: "Answer 3 different prompts" },
  { type: "prompt_all", emoji: "📝", name: "All Prompts", description: "Answered every prompt", hint: "Answer all available prompts" },
  { type: "first_event", emoji: "🎪", name: "First Event", description: "Signed up for first event", hint: "RSVP to an event" },
  { type: "event_regular", emoji: "🏃", name: "Event Regular", description: "Attended 3+ events", hint: "RSVP to 3 events" },
  { type: "event_og", emoji: "👑", name: "Event OG", description: "Attended 10+ events", hint: "RSVP to 10 events" },
  { type: "connector", emoji: "🔗", name: "Connector", description: "All socials linked", hint: "Add LinkedIn, Instagram & Twitter" },
  { type: "fire_starter", emoji: "⚡", name: "Fire Starter", description: "10+ reactions received", hint: "Get 10 fire reactions on your answers" },
  { type: "community_voice", emoji: "🌟", name: "Community Voice", description: "A prompt answer went viral", hint: "Get 5+ fires on a single answer" },
  { type: "recruiter", emoji: "🤝", name: "Recruiter", description: "Invited someone to FocusClub", hint: "Invite a friend who joins" },
  { type: "first_props", emoji: "🙏", name: "Got Props", description: "Received first prop ever", hint: "Get your first peer prop" },
  { type: "energy_magnet", emoji: "⚡", name: "Energy Magnet", description: "Received 10+ energy props", hint: "Get 10 energy props" },
  { type: "helper_badge", emoji: "🤝", name: "Always Helpful", description: "Received 10+ helpful props", hint: "Get 10 helpful props" },
  { type: "focus_idol", emoji: "🎯", name: "Focus Idol", description: "Received 10+ focused props", hint: "Get 10 focused props" },
  { type: "beloved", emoji: "💜", name: "Beloved", description: "Received 50+ total props from 10+ unique people", hint: "Get 50 props from 10+ people" },
];

export function getBadgeDef(type: string): BadgeDef | undefined {
  return BADGE_DEFINITIONS.find((b) => b.type === type);
}

export interface BadgeCheckStats {
  promptAnswerCount: number;
  totalPromptCount: number;
  eventGoingCount: number;
  totalFiresReceived: number;
  maxSingleFireCount: number;
  referralCount: number;
  totalPropsReceived: number;
  energyPropsReceived: number;
  helpfulPropsReceived: number;
  focusedPropsReceived: number;
  uniquePropGivers: number;
}

function checkEarnedBadges(
  profile: Profile,
  stats: BadgeCheckStats,
  existingBadgeTypes: string[]
): string[] {
  const newBadges: string[] = [];
  const has = (t: string) => existingBadgeTypes.includes(t);

  if (!has("early_adopter") && profile.created_at) {
    const launchDate = parseISO("2026-03-01");
    const joinDate = parseISO(profile.created_at);
    const diffDays = (joinDate.getTime() - launchDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 30) newBadges.push("early_adopter");
  }

  if (!has("complete_profile") && (profile.profile_completion ?? 0) >= 100) {
    newBadges.push("complete_profile");
  }

  if (!has("first_prompt") && stats.promptAnswerCount >= 1) newBadges.push("first_prompt");
  if (!has("prompt_streak_3") && stats.promptAnswerCount >= 3) newBadges.push("prompt_streak_3");
  if (!has("prompt_all") && stats.totalPromptCount > 0 && stats.promptAnswerCount >= stats.totalPromptCount) newBadges.push("prompt_all");

  if (!has("first_event") && stats.eventGoingCount >= 1) newBadges.push("first_event");
  if (!has("event_regular") && stats.eventGoingCount >= 3) newBadges.push("event_regular");
  if (!has("event_og") && stats.eventGoingCount >= 10) newBadges.push("event_og");

  if (!has("connector") && profile.linkedin_url && profile.instagram_handle && profile.twitter_handle) {
    newBadges.push("connector");
  }

  if (!has("fire_starter") && stats.totalFiresReceived >= 10) newBadges.push("fire_starter");
  if (!has("community_voice") && stats.maxSingleFireCount >= 5) newBadges.push("community_voice");

  if (!has("recruiter") && stats.referralCount >= 1) newBadges.push("recruiter");

  if (!has("first_props") && stats.totalPropsReceived >= 1) newBadges.push("first_props");
  if (!has("energy_magnet") && stats.energyPropsReceived >= 10) newBadges.push("energy_magnet");
  if (!has("helper_badge") && stats.helpfulPropsReceived >= 10) newBadges.push("helper_badge");
  if (!has("focus_idol") && stats.focusedPropsReceived >= 10) newBadges.push("focus_idol");
  if (!has("beloved") && stats.totalPropsReceived >= 50 && stats.uniquePropGivers >= 10) newBadges.push("beloved");

  return newBadges;
}

export async function fetchBadgeStats(userId: string): Promise<BadgeCheckStats> {
  const [promptAnswersRes, totalPromptsRes, eventGoingRes, firesRes, referralRes, propsRes] = await Promise.all([
    supabase.from("prompt_responses").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("prompts").select("id", { count: "exact", head: true }),
    supabase.from("event_rsvps").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "going"),
    supabase.from("prompt_responses").select("fire_count").eq("user_id", userId),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", userId),
    supabase.from("peer_props").select("prop_type, from_user").eq("to_user", userId) ,
  ]);

  const fireCounts = (firesRes.data || []).map((r) => r.fire_count || 0);
  const props = (propsRes.data || []) as { prop_type: string; from_user: string }[];
  const energyCount = props.filter(p => p.prop_type === "energy").length;
  const helpfulCount = props.filter(p => p.prop_type === "helpful").length;
  const focusedCount = props.filter(p => p.prop_type === "focused").length;
  const uniqueGivers = new Set(props.map(p => p.from_user)).size;

  return {
    promptAnswerCount: promptAnswersRes.count || 0,
    totalPromptCount: totalPromptsRes.count || 0,
    eventGoingCount: eventGoingRes.count || 0,
    totalFiresReceived: fireCounts.reduce((a, b) => a + b, 0),
    maxSingleFireCount: fireCounts.length > 0 ? Math.max(...fireCounts) : 0,
    referralCount: referralRes.count || 0,
    totalPropsReceived: props.length,
    energyPropsReceived: energyCount,
    helpfulPropsReceived: helpfulCount,
    focusedPropsReceived: focusedCount,
    uniquePropGivers: uniqueGivers,
  };
}

export async function checkAndAwardBadges(
  userId: string,
  profile: Profile,
): Promise<string[]> {
  try {
    const [stats, { data: existingBadges }] = await Promise.all([
      fetchBadgeStats(userId),
      supabase.from("member_badges").select("badge_type").eq("user_id", userId),
    ]);

    const existingTypes = (existingBadges || []).map((b) => b.badge_type);
    const newBadges = checkEarnedBadges(profile, stats, existingTypes);

    if (newBadges.length > 0) {
      for (const badge_type of newBadges) {
        await supabase.rpc("award_badge", { p_user_id: userId, p_badge_type: badge_type });
      }

      for (const badge_type of newBadges) {
        const def = getBadgeDef(badge_type)!;
        await supabase.rpc("create_system_notification", {
          p_user_id: userId,
          p_title: `Badge earned! ${def.emoji}`,
          p_body: def.description,
          p_type: "badge_earned",
          p_link: "/me",
        });
      }
    }

    return newBadges;
  } catch (error) {
    console.error("[CheckAndAwardBadges]", error);
    return [];
  }
}
