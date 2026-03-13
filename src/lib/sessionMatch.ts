/**
 * @module sessionMatch
 * @description Session recommendation scoring based on user preferences.
 * Scores sessions 0-100 based on: distance/radius (30pts), preferred day (25pts),
 * preferred time slot (25pts), work vibe match (10pts), duration match (10pts).
 *
 * Key exports:
 * - sessionMatchScore() — Returns numeric score for how well a session matches user preferences
 *
 * Dependencies: None (pure function, no external imports)
 * Related: Events.tsx (sorts/filters sessions by score), Home PrimaryActionCard.tsx (recommends next session)
 */
import { parseISO } from "date-fns";
// Session match scoring for preference-based recommendations

interface SessionInfo {
  date: string;
  start_time?: string | null;
  session_format?: string | null;
  neighborhood?: string | null;
  distance_km?: number;
}

interface UserPrefs {
  preferred_days?: string[];
  preferred_times?: string[];
  preferred_session_duration?: number;
  preferred_radius_km?: number;
  work_vibe?: string;
}

const DAY_MAP: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

function getTimeSlot(timeStr?: string | null): string | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2})/);
  if (!match) return null;
  let hour = parseInt(match[1]);
  if (timeStr.toLowerCase().includes('pm') && hour !== 12) hour += 12;
  if (timeStr.toLowerCase().includes('am') && hour === 12) hour = 0;
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

export function sessionMatchScore(session: SessionInfo, prefs: UserPrefs): number {
  let score = 0;

  // +30 if within preferred radius
  if (session.distance_km != null && prefs.preferred_radius_km) {
    if (session.distance_km <= prefs.preferred_radius_km) score += 30;
  }

  // +25 if on preferred day
  if (prefs.preferred_days && prefs.preferred_days.length > 0) {
    const dayOfWeek = DAY_MAP[parseISO(session.date).getDay()];
    if (prefs.preferred_days.includes(dayOfWeek)) score += 25;
  }

  // +25 if during preferred time
  if (prefs.preferred_times && prefs.preferred_times.length > 0) {
    const slot = getTimeSlot(session.start_time);
    if (slot && prefs.preferred_times.includes(slot)) score += 25;
  }

  // +10 if matching vibe
  if (prefs.work_vibe && session.session_format) {
    const vibeMap: Record<string, string[]> = {
      deep_focus: ['structured_2hr', 'structured_4hr'],
      casual_social: ['casual'],
      balanced: ['casual', 'structured_2hr'],
    };
    if (vibeMap[prefs.work_vibe]?.includes(session.session_format)) score += 10;
  }

  // +10 if matching duration
  if (prefs.preferred_session_duration) {
    const isDuration2 = session.session_format === 'structured_2hr' || session.session_format === 'casual';
    const isDuration4 = session.session_format === 'structured_4hr';
    if ((prefs.preferred_session_duration === 2 && isDuration2) ||
        (prefs.preferred_session_duration === 4 && isDuration4)) {
      score += 10;
    }
  }

  return score;
}
