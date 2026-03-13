/**
 * @module growth
 * @description 22 milestone definitions, analytics event tracking, milestone checking/awarding, and re-engagement logic.
 * Milestones cover event attendance, streaks, props, prompts, referrals, and membership duration.
 * Re-engagement sends contextual notifications to inactive users (7/10/14 day thresholds).
 *
 * Key exports:
 * - MILESTONES — Record of 22 milestone definitions with emoji, title, description, and shareable messages
 * - checkMilestones() — Check and award the next unearned milestone for a user via Supabase RPCs
 * - trackAnalyticsEvent() — Silent analytics event insertion (never throws)
 * - checkReEngagement() — Throttled re-engagement notification logic (once/day, 3-day cooldown between notifs)
 *
 * Dependencies: Supabase client (queries profiles, peer_props, prompt_responses, member_milestones, notifications; RPCs award_milestone, create_system_notification)
 * Side effects: checkReEngagement() reads/writes localStorage for throttling, updates profiles.last_active_at
 * Related: MilestoneCelebration.tsx (celebration UI), GrowthCards.tsx (progressive unlock cards), badges.ts (separate badge system)
 */
import { parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

// ─── Analytics Tracking ──────────────────────────────────
export async function trackAnalyticsEvent(
  eventType: string,
  userId?: string | null,
  metadata?: Record<string, any>
) {
  try {
    await supabase.from("analytics_events").insert({
      event_type: eventType,
      user_id: userId || null,
      metadata: metadata || {},
    });
  } catch (e) {
    // Silent fail — analytics should never break the app
    console.debug("[Analytics]", e);
  }
}

// ─── Milestone Definitions ──────────────────────────────
export interface MilestoneDef {
  type: string;
  emoji: string;
  title: string;
  description: string;
  shareMessage: (referralCode?: string | null) => string;
}

const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://focusclub.app";

export const MILESTONES: Record<string, MilestoneDef> = {
  first_event: {
    type: "first_event", emoji: "🎉", title: "First Session!",
    description: "You attended your first FocusClub session. Welcome to the community!",
    shareMessage: (ref) => `Just attended my first coworking session on FocusClub! 🎉 Join the community: ${APP_URL}/invite/${ref || ""}`,
  },
  events_3: {
    type: "events_3", emoji: "🎯", title: "Committed!",
    description: "3 sessions down. You're officially a regular.",
    shareMessage: (ref) => `I've hit 3 coworking sessions on FocusClub! 🎯 Officially a regular. Join us: ${APP_URL}/invite/${ref || ""}`,
  },
  events_5: {
    type: "events_5", emoji: "⭐", title: "High Five!",
    description: "5 sessions. You're in the top 20% of active members.",
    shareMessage: (ref) => `5 coworking sessions on FocusClub! ⭐ In the top 20% of active members. Join: ${APP_URL}/invite/${ref || ""}`,
  },
  events_10: {
    type: "events_10", emoji: "🏆", title: "Double Digits!",
    description: "10 sessions. You're now eligible to host events!",
    shareMessage: (ref) => `10 sessions on FocusClub! 🏆 Now I can host my own events. Join the community: ${APP_URL}/invite/${ref || ""}`,
  },
  events_25: {
    type: "events_25", emoji: "💎", title: "Quarter Century!",
    description: "25 sessions. You're a FocusClub legend.",
    shareMessage: (ref) => `25 coworking sessions on FocusClub! 💎 Legend status achieved. Join: ${APP_URL}/invite/${ref || ""}`,
  },
  events_50: {
    type: "events_50", emoji: "👑", title: "Hall of Fame!",
    description: "50 sessions. The community is better because of you.",
    shareMessage: (ref) => `50 sessions on FocusClub! 👑 Hall of Fame. This community is amazing: ${APP_URL}/invite/${ref || ""}`,
  },
  first_prop_given: {
    type: "first_prop_given", emoji: "🙌", title: "First Props Given!",
    description: "You recognized someone's contribution. That's what community is about.",
    shareMessage: (ref) => `Just gave my first props on FocusClub! 🙌 Love this community: ${APP_URL}/invite/${ref || ""}`,
  },
  first_prop_received: {
    type: "first_prop_received", emoji: "💛", title: "Got Props!",
    description: "Someone recognized you! Your presence matters.",
    shareMessage: (ref) => `Got my first props on FocusClub! 💛 People appreciate working together: ${APP_URL}/invite/${ref || ""}`,
  },
  props_received_25: {
    type: "props_received_25", emoji: "💛", title: "Loved by Many!",
    description: "25 props received. People really enjoy working with you.",
    shareMessage: (ref) => `25 props received on FocusClub! 💛 People enjoy coworking with me: ${APP_URL}/invite/${ref || ""}`,
  },
  props_received_50: {
    type: "props_received_50", emoji: "🌟", title: "Community Star!",
    description: "50 props. You make every session better.",
    shareMessage: (ref) => `50 props on FocusClub! 🌟 Community star status: ${APP_URL}/invite/${ref || ""}`,
  },
  first_prompt_answer: {
    type: "first_prompt_answer", emoji: "💬", title: "Voice Heard!",
    description: "You shared your first prompt answer. The community is listening.",
    shareMessage: (ref) => `Shared my first answer on FocusClub! 💬 Join the conversation: ${APP_URL}/invite/${ref || ""}`,
  },
  prompts_5: {
    type: "prompts_5", emoji: "📝", title: "5 Prompts!",
    description: "You've answered 5 prompts. Your profile is really coming to life.",
    shareMessage: (ref) => `Answered 5 community prompts on FocusClub! 📝 Building connections: ${APP_URL}/invite/${ref || ""}`,
  },
  streak_3: {
    type: "streak_3", emoji: "🔥", title: "On Fire!",
    description: "3 sessions in a row. Keep the momentum.",
    shareMessage: (ref) => `3 session streak on FocusClub! 🔥 Momentum is everything: ${APP_URL}/invite/${ref || ""}`,
  },
  streak_5: {
    type: "streak_5", emoji: "🔥", title: "Unstoppable!",
    description: "5 session streak. That's serious dedication.",
    shareMessage: (ref) => `5 session streak! 🔥🔥 Unstoppable on FocusClub: ${APP_URL}/invite/${ref || ""}`,
  },
  streak_10: {
    type: "streak_10", emoji: "🔥", title: "Legendary!",
    description: "10 session streak. You're inspiring others.",
    shareMessage: (ref) => `10 session streak! 🔥🔥🔥 Legendary dedication on FocusClub: ${APP_URL}/invite/${ref || ""}`,
  },
  referral_1: {
    type: "referral_1", emoji: "🤝", title: "First Recruit!",
    description: "You brought someone new to FocusClub.",
    shareMessage: (ref) => `Recruited my first member to FocusClub! 🤝 Growing the community: ${APP_URL}/invite/${ref || ""}`,
  },
  referral_3: {
    type: "referral_3", emoji: "🌱", title: "Community Builder!",
    description: "3 people joined through you.",
    shareMessage: (ref) => `3 people joined FocusClub through me! 🌱 Community builder: ${APP_URL}/invite/${ref || ""}`,
  },
  referral_10: {
    type: "referral_10", emoji: "🚀", title: "Growth Engine!",
    description: "10 referrals. You're building this community.",
    shareMessage: (ref) => `10 people joined FocusClub through me! 🚀 Growth engine: ${APP_URL}/invite/${ref || ""}`,
  },
  member_1_month: {
    type: "member_1_month", emoji: "📅", title: "One Month In!",
    description: "Thanks for being part of FocusClub.",
    shareMessage: (ref) => `One month on FocusClub! 📅 Loving this coworking community: ${APP_URL}/invite/${ref || ""}`,
  },
  member_3_months: {
    type: "member_3_months", emoji: "📅", title: "Quarter Year!",
    description: "3 months of focused coworking.",
    shareMessage: (ref) => `3 months on FocusClub! 📅 Best coworking community in Bangalore: ${APP_URL}/invite/${ref || ""}`,
  },
  member_6_months: {
    type: "member_6_months", emoji: "📅", title: "Half Year!",
    description: "6 months. You've been here since the early days.",
    shareMessage: (ref) => `6 months on FocusClub! 📅 OG member status: ${APP_URL}/invite/${ref || ""}`,
  },
  member_1_year: {
    type: "member_1_year", emoji: "🎂", title: "One Year!",
    description: "A full year of focused coworking. Thank you!",
    shareMessage: (ref) => `One year on FocusClub! 🎂 What a journey: ${APP_URL}/invite/${ref || ""}`,
  },
};

// ─── Check and Award Milestones ──────────────────────────
export async function checkMilestones(userId: string): Promise<MilestoneDef | null> {
  // Get existing milestones
  const { data: existing } = await supabase.from("member_milestones").select("milestone_type").eq("user_id", userId);
  const earned = new Set((existing || []).map((m: any) => m.milestone_type));

  // Get user stats
  const [{ data: profile }, { count: propsReceived }, { count: propsGiven }, { count: promptAnswers }, { count: referrals }] = await Promise.all([
    supabase.from("profiles").select("events_attended, current_streak, created_at").eq("id", userId).single(),
    supabase.from("peer_props").select("id", { count: "exact", head: true }).eq("to_user", userId),
    supabase.from("peer_props").select("id", { count: "exact", head: true }).eq("from_user", userId),
    supabase.from("prompt_responses").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", userId),
  ]);

  if (!profile) return null;
  const attended = profile.events_attended || 0;
  const streak = profile.current_streak || 0;
  const propsRx = propsReceived || 0;
  const propsTx = propsGiven || 0;
  const prompts = promptAnswers || 0;
  const refs = referrals || 0;
  const createdAt = profile.created_at ? parseISO(profile.created_at) : new Date();
  const monthsSince = Math.floor((Date.now() - createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000));

  // Check milestones in priority order (newest first)
  const checks: [string, boolean][] = [
    ["events_50", attended >= 50],
    ["events_25", attended >= 25],
    ["events_10", attended >= 10],
    ["events_5", attended >= 5],
    ["events_3", attended >= 3],
    ["first_event", attended >= 1],
    ["streak_10", streak >= 10],
    ["streak_5", streak >= 5],
    ["streak_3", streak >= 3],
    ["props_received_50", propsRx >= 50],
    ["props_received_25", propsRx >= 25],
    ["first_prop_received", propsRx >= 1],
    ["first_prop_given", propsTx >= 1],
    ["prompts_5", prompts >= 5],
    ["first_prompt_answer", prompts >= 1],
    ["referral_10", refs >= 10],
    ["referral_3", refs >= 3],
    ["referral_1", refs >= 1],
    ["member_1_year", monthsSince >= 12],
    ["member_6_months", monthsSince >= 6],
    ["member_3_months", monthsSince >= 3],
    ["member_1_month", monthsSince >= 1],
  ];

  // Find first unearned milestone that qualifies
  for (const [type, qualifies] of checks) {
    if (qualifies && !earned.has(type)) {
      // Award via RPC (bypasses RLS)
      await supabase.rpc("award_milestone", { p_user_id: userId, p_milestone_type: type });
      
      // Send notification via RPC
      const def = MILESTONES[type];
      if (def) {
        await supabase.rpc("create_system_notification", {
          p_user_id: userId,
          p_title: `${def.emoji} ${def.title}`,
          p_body: def.description,
          p_type: "milestone",
          p_link: "/home",
        });
      }
      return def || null;
    }
  }
  return null;
}

// ─── Re-engagement Check ──────────────────────────────
const RE_ENGAGEMENT_THROTTLE_KEY = "fc_reengagement_check";

export async function checkReEngagement(userId: string) {
  // Throttle: once per day
  const lastCheck = localStorage.getItem(RE_ENGAGEMENT_THROTTLE_KEY);
  const now = Date.now();
  if (lastCheck && now - parseInt(lastCheck) < 24 * 60 * 60 * 1000) return;
  localStorage.setItem(RE_ENGAGEMENT_THROTTLE_KEY, String(now));

  // Check last notification sent (throttle 3 days between re-engagement notifs)
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNotif } = await supabase.from("notifications")
    .select("id").eq("user_id", userId).eq("type", "re_engagement")
    .gte("created_at", threeDaysAgo).limit(1);
  if (recentNotif && recentNotif.length > 0) return;

  // Get last activity
  const { data: profile } = await supabase.from("profiles")
    .select("last_active_at, current_streak, neighborhood").eq("id", userId).single();
  if (!profile?.last_active_at) return;

  const lastActive = parseISO(profile.last_active_at);
  const daysSinceActive = Math.floor((now - lastActive.getTime()) / (24 * 60 * 60 * 1000));

  // Update last_active_at
  await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", userId);

  if (daysSinceActive < 7) return; // Still active

  // Check streak at risk (6+ days since last session)
  if (profile.current_streak && profile.current_streak > 0 && daysSinceActive >= 6 && daysSinceActive < 10) {
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "re_engagement",
      title: `🔥 Your ${profile.current_streak}-session streak is at risk!`,
      body: "Attend a session this week to keep it alive.",
      link: "/events",
    });
    return;
  }

  if (daysSinceActive >= 7 && daysSinceActive < 10) {
    // "We miss you" — 7 days
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: newMembers } = await supabase.from("profiles")
      .select("id", { count: "exact", head: true }).gte("created_at", oneWeekAgo);
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "re_engagement",
      title: "👋 It's been a while!",
      body: `${newMembers || 0} new members joined this week. Come say hi.`,
      link: "/discover",
    });
  } else if (daysSinceActive >= 10 && daysSinceActive < 14) {
    // "Matches have been busy" — 10 days
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "re_engagement",
      title: "Your matches have been busy!",
      body: "Check out what the community has been up to.",
      link: "/prompts",
    });
  } else if (daysSinceActive >= 14) {
    // "Events you're missing" — 14 days
    const today = new Date().toISOString().split("T")[0];
    const { count: upcomingEvents } = await supabase.from("events")
      .select("id", { count: "exact", head: true }).gte("date", today);
    if (upcomingEvents && upcomingEvents > 0) {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "re_engagement",
        title: `🎯 ${upcomingEvents} sessions happening soon!`,
        body: `Don't miss out${profile.neighborhood ? ` in ${profile.neighborhood}` : ""}.`,
        link: "/events",
      });
    }
  }
}
