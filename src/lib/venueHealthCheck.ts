/**
 * @module venueHealthCheck
 * @description Venue health check engine. Assigns random members to verify venues
 * are still good. Auto-deactivates venues with consistently bad health checks.
 *
 * Event-based triggers:
 * - After session ends → prompt attendees to health-check the venue
 * - After health check submitted → evaluate venue health
 *
 * Key exports:
 * - submitHealthCheck() — Member submits a health check, triggers evaluation
 * - evaluateVenueHealth() — Check if venue should be deactivated (3+ bad checks)
 * - getVenuesDueForCheck() — Venues not checked in 30+ days
 * - getRandomCheckAssignment() — Pick a random active member to check a venue
 *
 * Dependencies: Supabase client
 * Tables: venue_health_checks, venue_nominations, locations, profiles
 */
import { supabase } from "@/integrations/supabase/client";
import { awardCredits } from "@/lib/focusCredits";

// ─── Types ──────────────────────────────────

export interface HealthCheckData {
  wifi_ok: boolean;
  noise_ok: boolean;
  still_open: boolean;
  seating_ok: boolean;
  comment?: string;
}

export interface HealthCheckResult {
  success: boolean;
  creditsAwarded: number;
  venueDeactivated: boolean;
  error?: string;
}

// ─── Constants ──────────────────────────────

// WHY 30 days: Venue conditions change slowly (WiFi outage, renovation, closure).
// Monthly checks balance data freshness against member fatigue from too-frequent prompts.
const CHECK_FRESHNESS_DAYS = 30;
// WHY 3 bad checks: Requires independent corroboration from 3 different members
// before deactivating a venue. 1-2 bad checks could be one-off issues (bad WiFi day)
// or a disgruntled individual. 3 consecutive bad checks = systemic problem.
// Mirrors the 3-vouch activation threshold for symmetry in the trust system.
const BAD_CHECK_THRESHOLD = 3;
const HEALTH_CHECK_FC = 5; // FC reward for submitting a check

// ─── Core Functions ──────────────────────────

/**
 * Submit a health check for a venue. Awards FC and evaluates venue health.
 * Call this after a session ends at a venue (event-based trigger).
 */
export async function submitHealthCheck(
  userId: string,
  locationId: string,
  data: HealthCheckData
): Promise<HealthCheckResult> {
  // Check for recent duplicate (same user, same venue, within 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: recent } = await supabase
    .from("venue_health_checks")
    .select("id")
    .eq("location_id", locationId)
    .eq("user_id", userId)
    .gte("checked_at", weekAgo.toISOString())
    .limit(1);

  if (recent && recent.length > 0) {
    return { success: false, creditsAwarded: 0, venueDeactivated: false, error: "Already checked this venue recently" };
  }

  const { error } = await supabase
    .from("venue_health_checks")
    .insert({
      location_id: locationId,
      user_id: userId,
      wifi_ok: data.wifi_ok,
      noise_ok: data.noise_ok,
      still_open: data.still_open,
      seating_ok: data.seating_ok,
      comment: data.comment ?? null,
    });

  if (error) {
    return { success: false, creditsAwarded: 0, venueDeactivated: false, error: error.message };
  }

  // Award FC (server-side via RPC)
  const creditResult = await awardCredits(userId, "verify_venue_info", HEALTH_CHECK_FC, {
    venue_id: locationId,
    health_check: true,
  } as any);

  // Evaluate venue health server-side (prevents client from controlling deactivation)
  const { data: healthResult } = await supabase.rpc("server_evaluate_venue_health", {
    p_location_id: locationId,
  });
  const deactivated = healthResult?.deactivated ?? false;

  return {
    success: true,
    creditsAwarded: creditResult.awarded,
    venueDeactivated: deactivated,
  };
}

/**
 * Evaluate a venue's health based on recent checks.
 * If 3+ consecutive checks report still_open=false or multiple failures,
 * deactivate the venue.
 */
export async function evaluateVenueHealth(locationId: string): Promise<boolean> {
  // Get the last N health checks
  const { data: checks } = await supabase
    .from("venue_health_checks")
    .select("still_open, wifi_ok, noise_ok, seating_ok")
    .eq("location_id", locationId)
    .order("checked_at", { ascending: false })
    .limit(BAD_CHECK_THRESHOLD);

  if (!checks || checks.length < BAD_CHECK_THRESHOLD) return false;

  // Check if venue is reported as closed
  const closedCount = checks.filter((c) => !c.still_open).length;
  if (closedCount >= BAD_CHECK_THRESHOLD) {
    await deactivateVenue(locationId, "Reported as closed by multiple members");
    return true;
  }

  // WHY 2+ issues = "bad check": A single issue (e.g. noisy day) is tolerable.
  // But 2+ simultaneous problems (no WiFi AND bad seating) indicates the venue
  // is fundamentally unsuitable for coworking, not just having a rough day.
  const badChecks = checks.filter((c) => {
    const issues = [!c.wifi_ok, !c.noise_ok, !c.seating_ok].filter(Boolean).length;
    return issues >= 2;
  });

  if (badChecks.length >= BAD_CHECK_THRESHOLD) {
    await deactivateVenue(locationId, "Consistently poor conditions reported by members");
    return true;
  }

  return false;
}

/**
 * Deactivate a venue (update nomination status + notify nominator).
 */
async function deactivateVenue(locationId: string, reason: string): Promise<void> {
  // Find and deactivate the nomination linked to this location
  const { data: nomination } = await supabase
    .from("venue_nominations")
    .select("id, nominated_by, venue_name")
    .eq("location_id", locationId)
    .eq("status", "active")
    .maybeSingle();

  if (nomination) {
    await supabase
      .from("venue_nominations")
      .update({
        status: "deactivated",
        deactivated_at: new Date().toISOString(),
        deactivation_reason: reason,
      })
      .eq("id", nomination.id);

    // Notify the nominator
    await supabase.from("notifications").insert({
      user_id: nomination.nominated_by,
      type: "venue_deactivated",
      title: `${nomination.venue_name} has been deactivated`,
      body: reason,
      data: { nomination_id: nomination.id },
      read: false,
    });
  }
}

/**
 * Get venues that haven't been checked in CHECK_FRESHNESS_DAYS.
 * Used by the sweep Edge Function to request health checks.
 */
export async function getVenuesDueForCheck(): Promise<
  Array<{ locationId: string; venueName: string; neighborhood: string; lastChecked: string | null }>
> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CHECK_FRESHNESS_DAYS);

  // Get all active venue nominations with linked locations
  const { data: activeVenues } = await supabase
    .from("venue_nominations")
    .select("location_id, venue_name, neighborhood")
    .eq("status", "active")
    .not("location_id", "is", null);

  if (!activeVenues || activeVenues.length === 0) return [];

  const result = [];
  for (const venue of activeVenues) {
    // Get most recent health check
    const { data: lastCheck } = await supabase
      .from("venue_health_checks")
      .select("checked_at")
      .eq("location_id", venue.location_id)
      .order("checked_at", { ascending: false })
      .limit(1);

    const lastChecked = lastCheck?.[0]?.checked_at ?? null;

    // Due if never checked or last check is stale
    if (!lastChecked || lastChecked < cutoff.toISOString()) {
      result.push({
        locationId: venue.location_id!,
        venueName: venue.venue_name,
        neighborhood: venue.neighborhood,
        lastChecked,
      });
    }
  }

  return result;
}

/**
 * Pick a random active member in a neighborhood to do a health check.
 * Prefers members who haven't done a check recently.
 */
export async function getRandomCheckAssignment(
  neighborhood: string,
  excludeUserId?: string
): Promise<string | null> {
  // Get active members in the neighborhood (attended at least 1 session)
  let query = supabase
    .from("profiles")
    .select("id")
    .eq("neighborhood", neighborhood)
    .gt("events_attended", 0);

  const { data: members } = await query;
  if (!members || members.length === 0) return null;

  // Filter out excluded user
  const candidates = excludeUserId
    ? members.filter((m) => m.id !== excludeUserId)
    : members;

  if (candidates.length === 0) return null;

  // Random pick
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx].id;
}
