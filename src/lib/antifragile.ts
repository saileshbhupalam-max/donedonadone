/**
 * @module antifragile
 * @description Smart group formation, reliability tracking, waitlist management, and community safety.
 * Handles the core "antifragile" systems that make sessions work even when members cancel or misbehave.
 *
 * Key exports:
 * - createSmartGroups() — Forms balanced groups distributing captains, experienced members, newbies, and gender
 * - updateReliability() — Track RSVP/show/no-show/late-cancel via Supabase RPC
 * - joinWaitlist() / promoteWaitlist() — Waitlist queue management for full sessions
 * - getPopularityLabel() — Session availability labels ("Almost full", "Filling fast", etc.)
 * - checkFlagEscalation() — Auto-escalate members flagged by 2+ people across 2+ sessions
 * - CAPTAIN_NUDGES — Phase-specific nudge messages for table captains
 *
 * Dependencies: Supabase client (for reliability RPCs, waitlist operations, flag queries)
 * Related: Session.tsx (uses createSmartGroups), CaptainCard.tsx (uses CAPTAIN_NUDGES), Admin FlagsTab (uses checkFlagEscalation)
 */
// ─── Antifragile Systems: Captain, First-timer, Reliability, Waitlist ───
import { supabase } from "@/integrations/supabase/client";

// ─── Table Captain Matching ────────────────────────────
interface MatchAttendee {
  id: string;
  gender: string | null;
  events_attended: number;
  is_table_captain: boolean;
  no_show_count: number;
  reliability_status: string;
}

export function createSmartGroups(attendees: MatchAttendee[], groupSize: number = 4): MatchAttendee[][] {
  if (attendees.length === 0) return [];
  const numGroups = Math.max(1, Math.ceil(attendees.length / groupSize));
  const groups: MatchAttendee[][] = Array.from({ length: numGroups }, () => []);

  // Sort: captains first, then experienced, then new
  const captains = attendees.filter(a => a.is_table_captain);
  const experienced = attendees.filter(a => !a.is_table_captain && a.events_attended >= 3);
  const newbies = attendees.filter(a => !a.is_table_captain && a.events_attended < 3);

  // 1. Distribute captains across groups
  captains.forEach((c, i) => groups[i % numGroups].push(c));

  // 2. Ensure each group has at least 1 experienced member
  experienced.forEach(e => {
    const target = groups.reduce((min, g, i) => {
      const hasExp = g.some(m => m.events_attended >= 3);
      if (!hasExp && g.length < groups[min].length + 2) return i;
      return g.length < groups[min].length ? i : min;
    }, 0);
    groups[target].push(e);
  });

  // 3. Distribute newbies, never putting 4+ in same group without experienced
  newbies.forEach(n => {
    const target = groups.reduce((min, g, i) => {
      const newbieCount = g.filter(m => m.events_attended < 3).length;
      const hasExperienced = g.some(m => m.events_attended >= 3);
      // Prefer groups with experienced members and fewer newbies
      const score = g.length * 10 + (hasExperienced ? 0 : 50) + newbieCount * 5;
      const minScore = groups[min].length * 10 + (groups[min].some(m => m.events_attended >= 3) ? 0 : 50) + groups[min].filter(m => m.events_attended < 3).length * 5;
      return score < minScore ? i : min;
    }, 0);
    groups[target].push(n);
  });

  // 4. Gender balance pass: swap to improve balance
  for (let iter = 0; iter < 10; iter++) {
    let improved = false;
    for (let i = 0; i < numGroups; i++) {
      for (let j = i + 1; j < numGroups; j++) {
        for (let a = 0; a < groups[i].length; a++) {
          for (let b = 0; b < groups[j].length; b++) {
            const beforeBalance = getGroupGenderBalance(groups[i]) + getGroupGenderBalance(groups[j]);
            // Try swap
            [groups[i][a], groups[j][b]] = [groups[j][b], groups[i][a]];
            const afterBalance = getGroupGenderBalance(groups[i]) + getGroupGenderBalance(groups[j]);
            if (afterBalance <= beforeBalance) {
              // Revert
              [groups[i][a], groups[j][b]] = [groups[j][b], groups[i][a]];
            } else {
              improved = true;
            }
          }
        }
      }
    }
    if (!improved) break;
  }

  return groups.filter(g => g.length > 0);
}

function getGroupGenderBalance(group: MatchAttendee[]): number {
  const women = group.filter(a => a.gender === "woman" || a.gender === "female").length;
  const men = group.filter(a => a.gender === "man" || a.gender === "male").length;
  const total = women + men;
  if (total === 0) return 1;
  return Math.min(women, men) / total; // 0.5 = perfect balance
}

// ─── Reliability System ────────────────────────────────
export async function updateReliability(userId: string, type: "rsvp" | "show" | "no_show" | "late_cancel") {
  await supabase.rpc("update_reliability", { p_user_id: userId, p_type: type });
}

// ─── Waitlist System ───────────────────────────────────
export async function joinWaitlist(eventId: string, userId: string): Promise<number> {
  // Get current max position
  const { data: existing } = await supabase.from("session_waitlist").select("position").eq("event_id", eventId).order("position", { ascending: false }).limit(1);
  const nextPos = (existing && existing.length > 0) ? existing[0].position + 1 : 1;
  
  await supabase.from("session_waitlist").insert({ event_id: eventId, user_id: userId, position: nextPos });
  return nextPos;
}

export async function promoteWaitlist(eventId: string): Promise<string | null> {
  const { data } = await supabase.rpc("promote_waitlist", { p_event_id: eventId });
  return data as string | null;
}

// ─── Member Flagging ───────────────────────────────────
export async function checkFlagEscalation(flaggedUserId: string) {
  const { data: flags } = await supabase.from("member_flags").select("flagged_by, session_id").eq("flagged_user", flaggedUserId);
  if (!flags) return;

  const uniqueFlaggers = new Set(flags.map((f: any) => f.flagged_by));
  const uniqueSessions = new Set(flags.map((f: any) => f.session_id));

  if (uniqueFlaggers.size >= 2 && uniqueSessions.size >= 2) {
    // Auto-escalate to admin - in a real app, notify admin
    console.warn(`[Escalation] Member ${flaggedUserId} flagged by ${uniqueFlaggers.size} people across ${uniqueSessions.size} sessions`);
  }
}

// ─── Popularity Indicators ─────────────────────────────
export function getPopularityLabel(goingCount: number, maxSpots: number | null, waitlistCount: number = 0): string | null {
  if (!maxSpots) return null;
  if (goingCount >= maxSpots) return waitlistCount > 0 ? `Waitlist: ${waitlistCount} people` : "Full";
  const pct = goingCount / maxSpots;
  if (pct >= 0.8) return "Almost full";
  if (pct >= 0.5) return "Filling fast";
  if (pct < 0.3 && goingCount > 0) return "Quiet session — great for focused work";
  return `${maxSpots - goingCount} spots left`;
}

// ─── Captain Nudges ────────────────────────────────────
export const CAPTAIN_NUDGES: Record<string, string> = {
  icebreaker: "Captain nudge: Read the icebreaker out loud to your table 👋",
  deep_work: "Captain nudge: Time to settle in. A quick 'let's focus' does wonders.",
  social_break: "Captain nudge: Check if everyone's good. Introduce people who haven't chatted.",
  mini_break: "Captain nudge: Check if everyone's good. Introduce people who haven't chatted.",
  wrap_up: "Captain nudge: Go around the table — what did everyone accomplish?",
};
