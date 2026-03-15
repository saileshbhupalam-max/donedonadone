/**
 * @module sessionSafety
 * @description Session safety net: cancellation cascade and no-show processing.
 * Handles the consequences when members cancel or ghost sessions.
 *
 * Key exports:
 * - cancelRsvp() — Cancel RSVP with server-side cascade (penalty, waitlist, at-risk notifications)
 * - processSessionNoShows() — Post-session: detect ghost no-shows and apply FC penalties
 *
 * Dependencies: Supabase client (calls RPCs)
 * Tables (via RPCs): event_rsvps, events, focus_credits, notifications, profiles, session_waitlist
 */
import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────

export interface CancelResult {
  success: boolean;
  penaltyAmount: number;
  promotedFromWaitlist: boolean;
  sessionAtRisk: boolean;
  sessionCancelled: boolean;
  goingCount: number;
  error?: string;
}

export interface NoShowResult {
  success: boolean;
  noShowsProcessed: number;
  error?: string;
}

// ─── Core Functions ──────────────────────────

/**
 * Cancel an RSVP with full server-side cascade handling.
 * The server RPC (server_cancel_rsvp) atomically:
 * 1. Deletes the RSVP + decrements rsvp_count
 * 2. Applies -10 FC penalty if < 2 hours before start
 * 3. Tracks late_cancel in reliability system
 * 4. Promotes next person from waitlist
 * 5. If going count drops below minimum_attendees:
 *    - < 24h to start → notifies remaining "session at risk"
 *    - < 2h to start → auto-cancels session (unless guaranteed)
 */
export async function cancelRsvp(eventId: string, userId: string): Promise<CancelResult> {
  const { data, error } = await supabase.rpc("user_cancel_rsvp", {
    p_event_id: eventId,
  });

  if (error) {
    console.error("[sessionSafety] server_cancel_rsvp error:", error);
    return {
      success: false,
      penaltyAmount: 0,
      promotedFromWaitlist: false,
      sessionAtRisk: false,
      sessionCancelled: false,
      goingCount: 0,
      error: error.message,
    };
  }

  const result = data as {
    success: boolean;
    penalty_amount: number;
    promoted_from_waitlist: boolean;
    session_at_risk: boolean;
    session_cancelled: boolean;
    going_count: number;
    error?: string;
  };

  return {
    success: result.success,
    penaltyAmount: result.penalty_amount ?? 0,
    promotedFromWaitlist: result.promoted_from_waitlist ?? false,
    sessionAtRisk: result.session_at_risk ?? false,
    sessionCancelled: result.session_cancelled ?? false,
    goingCount: result.going_count ?? 0,
    error: result.error,
  };
}

/**
 * Process no-shows for a completed session. Called by admin or Edge Function
 * cron after session end time.
 *
 * Ghost no-shows (RSVPed "going", never submitted feedback) get:
 * - -20 FC penalty
 * - no_show reliability update
 * - no_show_count increment on profile
 * - In-app notification
 *
 * Self-reported no-shows ("I wasn't there" in feedback) are NOT penalized
 * again — honesty gets lighter treatment (just the profile counter).
 */
export async function processSessionNoShows(eventId: string): Promise<NoShowResult> {
  const { data, error } = await supabase.rpc("server_process_no_shows", {
    p_event_id: eventId,
  });

  if (error) {
    console.error("[sessionSafety] server_process_no_shows error:", error);
    return { success: false, noShowsProcessed: 0, error: error.message };
  }

  const result = data as { success: boolean; no_shows_processed: number; error?: string };
  return {
    success: result.success,
    noShowsProcessed: result.no_shows_processed ?? 0,
    error: result.error,
  };
}
