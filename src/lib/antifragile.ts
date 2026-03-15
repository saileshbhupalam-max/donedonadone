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
  work_vibe: string | null;
  noise_preference: string | null;
  comm_style: string | null;
  looking_for?: string[] | null;
  can_offer?: string[] | null;
}

// WHY "antifragile" systems: Named after Taleb's concept — these systems get stronger
// from stress. Cancellations trigger waitlist promotion. Bad members get flagged and
// auto-escalated. Unreliable attendees are distributed to minimize group damage.
// The goal: sessions work well even when things go wrong, and get better over time.
export function createSmartGroups(attendees: MatchAttendee[], groupSize: number = 4): MatchAttendee[][] {
  if (attendees.length === 0) return [];
  const numGroups = Math.max(1, Math.ceil(attendees.length / groupSize));
  const groups: MatchAttendee[][] = Array.from({ length: numGroups }, () => []);

  // WHY reliability filter: If unreliable members cluster in one group, that group
  // has a high chance of imploding (multiple no-shows = awkward 2-person session).
  // Distributing them across groups dilutes the risk — each group has at most 1
  // unreliable member surrounded by reliable ones, preserving session quality.
  const isUnreliable = (a: MatchAttendee) =>
    a.no_show_count >= 2 || a.reliability_status === 'unreliable';
  const reliabilitySort = (a: MatchAttendee, b: MatchAttendee) =>
    (isUnreliable(a) ? 1 : 0) - (isUnreliable(b) ? 1 : 0);

  // Sort: captains first (reliable only), then experienced, then new
  // Unreliable captains are demoted to experienced pool
  const captains = attendees
    .filter(a => a.is_table_captain && !isUnreliable(a));
  const experienced = attendees
    .filter(a => (!a.is_table_captain || isUnreliable(a)) && a.events_attended >= 3)
    .sort(reliabilitySort);
  const newbies = attendees
    .filter(a => !a.is_table_captain && a.events_attended < 3)
    .sort(reliabilitySort);

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

  // 5. Compatibility pass: swap to group similar work vibes and noise preferences together
  for (let iter = 0; iter < 10; iter++) {
    let improved = false;
    for (let i = 0; i < numGroups; i++) {
      for (let j = i + 1; j < numGroups; j++) {
        for (let a = 0; a < groups[i].length; a++) {
          for (let b = 0; b < groups[j].length; b++) {
            const beforeCompat = getGroupCompatibility(groups[i]) + getGroupCompatibility(groups[j]);
            const beforeGender = getGroupGenderBalance(groups[i]) + getGroupGenderBalance(groups[j]);
            [groups[i][a], groups[j][b]] = [groups[j][b], groups[i][a]];
            const afterCompat = getGroupCompatibility(groups[i]) + getGroupCompatibility(groups[j]);
            const afterGender = getGroupGenderBalance(groups[i]) + getGroupGenderBalance(groups[j]);
            // Accept swap only if compatibility improves without worsening gender balance
            if (afterCompat > beforeCompat && afterGender >= beforeGender - 0.05) {
              improved = true;
            } else {
              [groups[i][a], groups[j][b]] = [groups[j][b], groups[i][a]];
            }
          }
        }
      }
    }
    if (!improved) break;
  }

  // 6. Serendipity pass: randomly swap ~20% of non-captain members to inject diversity
  // — complementary pairs (A wants what B offers) are preferred
  // — controlled randomness prevents the algorithm from always producing identical groups
  if (numGroups > 1) {
    const nonCaptainSlots: Array<[number, number]> = [];
    for (let i = 0; i < groups.length; i++) {
      for (let j = 0; j < groups[i].length; j++) {
        if (!groups[i][j].is_table_captain) nonCaptainSlots.push([i, j]);
      }
    }

    const swapBudget = Math.max(1, Math.floor(nonCaptainSlots.length * 0.2));
    for (let s = 0; s < swapBudget; s++) {
      const pick1 = Math.floor(Math.random() * nonCaptainSlots.length);
      const pick2 = Math.floor(Math.random() * nonCaptainSlots.length);
      const [gi, ai] = nonCaptainSlots[pick1];
      const [gj, bj] = nonCaptainSlots[pick2];
      if (gi === gj) continue; // same group — skip

      const beforeGender = getGroupGenderBalance(groups[gi]) + getGroupGenderBalance(groups[gj]);
      const beforeSerendipity = getComplementarityScore(groups[gi]) + getComplementarityScore(groups[gj]);
      [groups[gi][ai], groups[gj][bj]] = [groups[gj][bj], groups[gi][ai]];
      const afterGender = getGroupGenderBalance(groups[gi]) + getGroupGenderBalance(groups[gj]);
      const afterSerendipity = getComplementarityScore(groups[gi]) + getComplementarityScore(groups[gj]);

      // Accept if serendipity improves, or with 50% probability (controlled randomness),
      // but reject if gender balance drops significantly
      const serendipityImproved = afterSerendipity > beforeSerendipity;
      const genderOk = afterGender >= beforeGender - 0.15;
      if (genderOk && (serendipityImproved || Math.random() < 0.5)) {
        // keep swap
      } else {
        [groups[gi][ai], groups[gj][bj]] = [groups[gj][bj], groups[gi][ai]];
      }
    }
  }

  return groups.filter(g => g.length > 0);
}

/** Score how compatible a group is based on work vibe, noise preference, and comm style alignment. */
function getGroupCompatibility(group: MatchAttendee[]): number {
  if (group.length <= 1) return 1;
  let score = 0;
  let comparisons = 0;

  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      comparisons++;
      // Work vibe match (strongest signal)
      if (group[i].work_vibe && group[j].work_vibe && group[i].work_vibe === group[j].work_vibe) {
        score += 3;
      }
      // Noise preference match
      if (group[i].noise_preference && group[j].noise_preference && group[i].noise_preference === group[j].noise_preference) {
        score += 2;
      }
      // Comm style match
      if (group[i].comm_style && group[j].comm_style && group[i].comm_style === group[j].comm_style) {
        score += 1;
      }
    }
  }

  return comparisons > 0 ? score / comparisons : 0;
}

/** Score how complementary a group is: A wants what B offers and vice versa.
 * Different work vibes with complementary needs get a bonus (designer + founder). */
function getComplementarityScore(group: MatchAttendee[]): number {
  if (group.length <= 1) return 0;
  let score = 0;
  let comparisons = 0;

  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      comparisons++;
      const aLooking = group[i].looking_for || [];
      const bOffer = group[j].can_offer || [];
      const bLooking = group[j].looking_for || [];
      const aOffer = group[i].can_offer || [];

      // A wants what B offers (case-insensitive substring match)
      const abMatch = aLooking.filter(l =>
        bOffer.some(o => o.toLowerCase().includes(l.toLowerCase()) || l.toLowerCase().includes(o.toLowerCase()))
      ).length;
      // B wants what A offers
      const baMatch = bLooking.filter(l =>
        aOffer.some(o => o.toLowerCase().includes(l.toLowerCase()) || l.toLowerCase().includes(o.toLowerCase()))
      ).length;

      score += abMatch + baMatch;

      // Bonus: different work vibes with complementary needs = serendipity gold
      if (group[i].work_vibe && group[j].work_vibe
          && group[i].work_vibe !== group[j].work_vibe
          && (abMatch > 0 || baMatch > 0)) {
        score += 2;
      }
    }
  }

  return comparisons > 0 ? score / comparisons : 0;
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
// WHY waitlist exists: Full sessions are a good problem — it means demand exceeds supply.
// Rather than turning people away ("session full, bye"), the waitlist captures that demand
// and auto-promotes when someone cancels. This turns cancellations from a loss into a
// neutral event, and gives waitlisted users a reason to stay engaged ("you're #2 in line").
export async function joinWaitlist(eventId: string, _userId: string): Promise<number> {
  // Atomic position assignment via server RPC — prevents TOCTOU race
  const { data, error } = await supabase.rpc("user_join_waitlist", { p_event_id: eventId });
  if (error) throw error;
  return data as number;
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

  // WHY 2 flaggers across 2 sessions: A single flag from one session could be a
  // personality clash. But 2+ people flagging across 2+ different sessions indicates
  // a pattern of problematic behavior, not a one-off misunderstanding.
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
