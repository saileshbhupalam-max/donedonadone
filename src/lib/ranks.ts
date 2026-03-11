/**
 * @module ranks
 * @description 6-tier rank system based on focus hours, focus hour calculation/tracking,
 * monthly title definitions, and exclusive achievement definitions.
 * Ranks: Newcomer (0hr) → Getting Started (5hr) → Regular (15hr) → Deep Worker (35hr) → Elite (75hr) → Grandmaster (150hr+).
 *
 * Key exports:
 * - RANK_TIERS — Array of 6 rank tiers with visual styling (ring color, glow, card border/bg)
 * - getRankForHours() / getNextRank() / getRankProgress() — Rank lookup and progression calculation
 * - calculateSessionHours() — Derive focus hours from session format/times (4hr→3hrs, 2hr→1.33hrs)
 * - addFocusHours() — Update user's focus_hours + focus_rank, notify on rank-up, check first-to achievements
 * - MONTHLY_TITLE_DEFS — 6 monthly title types (Focus Champion, Rising Star, Most Loved, etc.)
 * - ACHIEVEMENT_DEFS — 11 achievement definitions including exclusive first-to milestones
 *
 * Dependencies: Supabase client (updates profiles, queries exclusive_achievements; RPCs award_badge, create_system_notification)
 * Related: RankAvatar.tsx, RankBadge.tsx (visual display), LeaderboardSection.tsx, AchievementsSection.tsx, MonthlyTitlesSection.tsx
 */
import { supabase } from "@/integrations/supabase/client";

export interface RankTier {
  name: string;
  emoji: string;
  minHours: number;
  maxHours: number;
  ringColor: string | null;
  ringWidth: number;
  glow: boolean;
  cardBorder: string;
  cardBg: string;
  motivation: string;
}

export const RANK_TIERS: RankTier[] = [
  {
    name: "Newcomer", emoji: "🌱", minHours: 0, maxHours: 5,
    ringColor: null, ringWidth: 0, glow: false,
    cardBorder: "", cardBg: "",
    motivation: "Every hour of focused work counts. Keep going!",
  },
  {
    name: "Getting Started", emoji: "⚡", minHours: 5, maxHours: 15,
    ringColor: "#7B9E87", ringWidth: 2, glow: false,
    cardBorder: "border-l-2 border-l-[#7B9E87]", cardBg: "",
    motivation: "You're building a habit. The hardest part is starting.",
  },
  {
    name: "Regular", emoji: "🔥", minHours: 15, maxHours: 35,
    ringColor: "#C47B5A", ringWidth: 2, glow: false,
    cardBorder: "border-l-2 border-l-[#C47B5A]", cardBg: "",
    motivation: "You're in the groove now. The community sees your commitment.",
  },
  {
    name: "Deep Worker", emoji: "💎", minHours: 35, maxHours: 75,
    ringColor: "#C47B5A", ringWidth: 3, glow: false,
    cardBorder: "border-l-3 border-l-[#C47B5A]", cardBg: "bg-gradient-to-r from-[#C47B5A]/5 to-transparent",
    motivation: "Top 20% of FocusClub. You're inspiring others.",
  },
  {
    name: "Elite", emoji: "🏆", minHours: 75, maxHours: 150,
    ringColor: "#D4A853", ringWidth: 3, glow: false,
    cardBorder: "border-l-3 border-l-[#D4A853]", cardBg: "bg-gradient-to-r from-[#D4A853]/10 to-[#C47B5A]/5",
    motivation: "Among the most dedicated members. Legendary status awaits.",
  },
  {
    name: "Grandmaster", emoji: "👑", minHours: 150, maxHours: Infinity,
    ringColor: "#D4A853", ringWidth: 3, glow: true,
    cardBorder: "border-2 border-[#D4A853]", cardBg: "bg-gradient-to-r from-[#D4A853]/15 to-[#C47B5A]/10",
    motivation: "You've reached the summit. The community looks up to you.",
  },
];

export function getRankForHours(hours: number): RankTier {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (hours >= RANK_TIERS[i].minHours) return RANK_TIERS[i];
  }
  return RANK_TIERS[0];
}

export function getNextRank(hours: number): RankTier | null {
  const current = getRankForHours(hours);
  const idx = RANK_TIERS.indexOf(current);
  return idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;
}

export function getRankProgress(hours: number): { current: RankTier; next: RankTier | null; progress: number; hoursToNext: number } {
  const current = getRankForHours(hours);
  const next = getNextRank(hours);
  if (!next) return { current, next: null, progress: 100, hoursToNext: 0 };
  const rangeSize = next.minHours - current.minHours;
  const inRange = hours - current.minHours;
  return {
    current,
    next,
    progress: Math.min(100, Math.round((inRange / rangeSize) * 100)),
    hoursToNext: Math.round((next.minHours - hours) * 10) / 10,
  };
}

/**
 * Calculate focus hours from an event's times and type.
 * structured_4hr → 3hrs, structured_2hr → 1.33hrs, else full duration
 */
export function calculateSessionHours(startTime: string | null, endTime: string | null, title: string, sessionFormat?: string | null): number {
  // Check session_format first
  if (sessionFormat === "structured_4hr") return 3;
  if (sessionFormat === "structured_2hr") return 1.33;

  const titleLower = (title || "").toLowerCase();
  if (titleLower.includes("4hr") || titleLower.includes("4 hour") || titleLower.includes("structured 4")) return 3;
  if (titleLower.includes("2hr") || titleLower.includes("2 hour") || titleLower.includes("structured 2")) return 1.33;

  // Calculate from start/end time
  if (startTime && endTime) {
    const parseTime = (t: string): number => {
      const parts = t.match(/(\d+):?(\d*)\s*(am|pm)?/i);
      if (!parts) return 0;
      let h = parseInt(parts[1]);
      const m = parseInt(parts[2] || "0");
      if (parts[3]?.toLowerCase() === "pm" && h < 12) h += 12;
      if (parts[3]?.toLowerCase() === "am" && h === 12) h = 0;
      return h + m / 60;
    };
    const diff = parseTime(endTime) - parseTime(startTime);
    return diff > 0 ? Math.round(diff * 10) / 10 : 2; // fallback 2hrs
  }
  return 2; // default
}

/**
 * After marking attendance, update focus_hours and focus_rank
 */
export async function addFocusHours(userId: string, hours: number): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("focus_hours")
    .eq("id", userId)
    .single();

  const currentHours = Number(profile?.focus_hours ?? 0);
  const newHours = Math.round((currentHours + hours) * 10) / 10;
  const newRank = getRankForHours(newHours);
  const oldRank = getRankForHours(currentHours);

  await supabase.from("profiles").update({
    focus_hours: newHours,
    focus_rank: newRank.name,
  }).eq("id", userId);

  // If rank changed, notify all members
  if (oldRank.name !== newRank.name) {
    const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", userId).single();
    const name = prof?.display_name || "Someone";

    // Get all member IDs
    const { data: members } = await supabase.from("profiles")
      .select("id")
      .eq("onboarding_completed", true)
      .neq("id", userId);

    if (members && members.length > 0) {
      for (const m of members) {
        await supabase.rpc("create_system_notification", {
          p_user_id: m.id,
          p_title: `🎉 ${name} reached ${newRank.emoji} ${newRank.name}!`,
          p_body: `They've logged ${newHours} focus hours.`,
          p_type: "rank_up",
          p_link: `/profile/${userId}`,
        });
      }
    }

    // Check first-to achievements
    await checkFirstToAchievements(userId, newHours);
  }
}

async function checkFirstToAchievements(userId: string, hours: number) {
  const thresholds = [
    { hours: 50, type: "first_to_50" },
    { hours: 100, type: "first_to_100" },
    { hours: 200, type: "first_to_200" },
  ];

  for (const t of thresholds) {
    if (hours >= t.hours) {
      // Check if anyone already has it
      const { data: existing } = await supabase
        .from("exclusive_achievements")
        .select("id")
        .eq("achievement_type", t.type)
        .limit(1);

      if (!existing || existing.length === 0) {
        // Award via RPC
        await supabase.rpc("award_badge", { p_user_id: userId, p_badge_type: t.type });

        // Notify everyone via RPC
        const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", userId).single();
        const name = prof?.display_name || "Someone";
        const { data: members } = await supabase.from("profiles")
          .select("id").eq("onboarding_completed", true).neq("id", userId);
        if (members && members.length > 0) {
          for (const m of members) {
            await supabase.rpc("create_system_notification", {
              p_user_id: m.id,
              p_title: `🥇 ${name} is the first to reach ${t.hours} focus hours!`,
              p_body: "Legendary.",
              p_type: "achievement",
              p_link: `/profile/${userId}`,
            });
          }
        }
      }
    }
  }
}

// Monthly title definitions
export const MONTHLY_TITLE_DEFS: Record<string, { emoji: string; name: string; description: string }> = {
  focus_champion: { emoji: "🏆", name: "Focus Champion", description: "Most focus hours logged this month" },
  rising_star: { emoji: "🚀", name: "Rising Star", description: "Biggest increase in focus hours vs previous month" },
  most_loved: { emoji: "💛", name: "Most Loved", description: "Most props received this month" },
  community_voice: { emoji: "🌟", name: "Community Voice", description: "Most 🔥 on prompt answers this month" },
  connector: { emoji: "🤝", name: "Connector", description: "Most successful referrals this month" },
  session_mvp: { emoji: "⭐", name: "Session MVP", description: "Highest average props-per-session this month" },
};

// Exclusive achievement definitions
export interface AchievementDef {
  type: string;
  emoji: string;
  name: string;
  description: string;
  hint: string;
  exclusive?: boolean; // only one person ever
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { type: "og_member", emoji: "🌱", name: "OG Member", description: "Joined FocusClub before June 2026", hint: "Join in the first 3 months", exclusive: false },
  { type: "summer_grinder_2026", emoji: "🏖️", name: "Summer Grinder 2026", description: "30+ focus hours Jun-Aug 2026", hint: "Log 30+ hours in summer 2026", exclusive: false },
  { type: "first_to_50", emoji: "🥇", name: "First to 50", description: "First person to reach 50 focus hours", hint: "Be the first to 50 hours", exclusive: true },
  { type: "first_to_100", emoji: "🥇", name: "First to 100", description: "First person to reach 100 focus hours", hint: "Be the first to 100 hours", exclusive: true },
  { type: "first_to_200", emoji: "🥇", name: "First to 200", description: "First person to reach 200 focus hours", hint: "Be the first to 200 hours", exclusive: true },
  { type: "century_props", emoji: "🥇", name: "Century Props", description: "First to receive 100 props", hint: "Be the first to get 100 🔥", exclusive: true },
  { type: "perfect_month", emoji: "⚡", name: "Perfect Month", description: "Attended 1+ session every week for a month", hint: "Attend every week in a month", exclusive: false },
  { type: "iron_streak", emoji: "🔥", name: "Iron Streak", description: "10+ session streak", hint: "Maintain a 10-session streak", exclusive: false },
  { type: "triple_threat", emoji: "💎", name: "Triple Threat", description: "Won monthly titles 3 different months", hint: "Win titles in 3 months", exclusive: false },
  { type: "full_house", emoji: "🌟", name: "Full House", description: "Earned all 6 monthly title types", hint: "Win every type of monthly title", exclusive: false },
  { type: "squad_goals", emoji: "🤝", name: "Squad Goals", description: "Coworked with same person 5+ times", hint: "Attend 5 events with the same person", exclusive: false },
];

export function getAchievementDef(type: string): AchievementDef | undefined {
  return ACHIEVEMENT_DEFS.find(a => a.type === type);
}
