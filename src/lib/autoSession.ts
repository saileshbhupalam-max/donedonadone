/**
 * @module autoSession
 * @description Auto-session creation from demand signals. When 3+ session_requests
 * cluster in the same neighborhood + time window, auto-creates an event at the
 * best-rated active venue and assigns a table captain.
 *
 * Key exports:
 * - checkDemandAndCreateSessions() — Main function: find demand clusters, create sessions
 * - findDemandClusters() — Group pending requests by neighborhood + preferred_time
 * - pickBestVenue() — Find highest-rated active venue in a neighborhood
 * - pickTableCaptain() — Select best captain candidate from requesters
 * - fulfillRequests() — Mark clustered requests as fulfilled
 *
 * - onNewSessionRequest() — Event-based trigger: call after each new request to check if cluster just completed
 *
 * Dependencies: Supabase client, neighborhoods
 * Tables: session_requests, events, locations, profiles, venue_nominations
 */
import { supabase } from "@/integrations/supabase/client";
import { normalizeNeighborhood } from "@/lib/neighborhoods";

// ─── Types ──────────────────────────────────

export interface DemandCluster {
  neighborhood: string;
  preferredTime: string;
  requests: SessionRequest[];
  clusterKey: string;
}

interface SessionRequest {
  id: string;
  user_id: string;
  neighborhood: string;
  preferred_time: string;
  venue_preference: string | null;
  created_at: string;
}

interface VenueCandidate {
  id: string;
  name: string;
  address: string | null;
  neighborhood: string;
  avg_rating: number;
}

interface CaptainCandidate {
  id: string;
  display_name: string;
  is_table_captain: boolean;
  events_attended: number;
}

export interface AutoSessionResult {
  created: number;
  errors: string[];
  sessions: Array<{ eventId: string; neighborhood: string; venue: string; attendees: number }>;
}

// ─── Constants ──────────────────────────────

const MIN_CLUSTER_SIZE = 3;

// Map preferred_time labels to actual start times
const TIME_SLOT_MAP: Record<string, { start: string; format: string }> = {
  morning: { start: "09:00", format: "focus_only_2hr" },
  afternoon: { start: "14:00", format: "structured_2hr" },
  evening: { start: "18:00", format: "structured_2hr" },
};

// ─── Core Functions ──────────────────────────

/**
 * Find demand clusters: group pending session_requests by neighborhood + preferred_time.
 * Returns only clusters with >= MIN_CLUSTER_SIZE requests.
 */
export async function findDemandClusters(): Promise<DemandCluster[]> {
  const { data: requests, error } = await supabase
    .from("session_requests")
    .select("id, user_id, neighborhood, preferred_time, venue_preference, created_at")
    .eq("status", "pending")
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: true });

  if (error || !requests) return [];

  const groups: Record<string, SessionRequest[]> = {};
  for (const r of requests as SessionRequest[]) {
    const key = `${r.neighborhood}__${r.preferred_time}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  return Object.entries(groups)
    .filter(([, reqs]) => reqs.length >= MIN_CLUSTER_SIZE)
    .map(([key, reqs]) => ({
      neighborhood: reqs[0].neighborhood,
      preferredTime: reqs[0].preferred_time,
      requests: reqs,
      clusterKey: key,
    }));
}

/**
 * Pick the best venue in a neighborhood. Checks:
 * 1. Active venues from venue_nominations (community-verified)
 * 2. Existing locations in the neighborhood
 * Falls back to the first available location if no ratings exist.
 */
export async function pickBestVenue(
  neighborhood: string,
  preferredVenueId?: string | null
): Promise<VenueCandidate | null> {
  // If a specific venue was requested and it exists, use it
  if (preferredVenueId) {
    const { data: preferred } = await supabase
      .from("locations")
      .select("id, name, address, neighborhood")
      .eq("id", preferredVenueId)
      .maybeSingle();

    if (preferred) {
      return { ...preferred, avg_rating: 0 };
    }
  }

  // Check community-verified venues first (from venue_nominations with status='active')
  const { data: activeNominations } = await supabase
    .from("venue_nominations")
    .select("location_id, venue_name, address, neighborhood, vouch_count")
    .eq("neighborhood", neighborhood)
    .eq("status", "active")
    .order("vouch_count", { ascending: false })
    .limit(1);

  if (activeNominations && activeNominations.length > 0 && activeNominations[0].location_id) {
    const nom = activeNominations[0];
    return {
      id: nom.location_id,
      name: nom.venue_name,
      address: nom.address,
      neighborhood: nom.neighborhood,
      avg_rating: nom.vouch_count,
    };
  }

  // Fall back to existing locations in the neighborhood
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, address, neighborhood")
    .eq("neighborhood", neighborhood)
    .limit(5);

  if (!locations || locations.length === 0) return null;

  // Pick the one with the most check-ins as a proxy for quality
  let bestLocation = locations[0];
  let bestCount = 0;

  for (const loc of locations) {
    const { count } = await supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("location_id", loc.id);

    if ((count ?? 0) > bestCount) {
      bestCount = count ?? 0;
      bestLocation = loc;
    }
  }

  return { ...bestLocation, avg_rating: bestCount };
}

/**
 * Pick the best table captain from a set of user IDs.
 * Priority: is_table_captain flag > most events_attended > first in list.
 */
export async function pickTableCaptain(userIds: string[]): Promise<string | null> {
  if (userIds.length === 0) return null;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, is_table_captain, events_attended")
    .in("id", userIds);

  if (!profiles || profiles.length === 0) return userIds[0];

  const candidates = (profiles as CaptainCandidate[]).sort((a, b) => {
    // Existing table captains first
    if (a.is_table_captain && !b.is_table_captain) return -1;
    if (!a.is_table_captain && b.is_table_captain) return 1;
    // Then by events attended
    return (b.events_attended ?? 0) - (a.events_attended ?? 0);
  });

  return candidates[0].id;
}

/**
 * Create an auto-session event for a demand cluster.
 */
async function createAutoEvent(
  cluster: DemandCluster,
  venue: VenueCandidate,
  captainId: string
): Promise<string | null> {
  const timeSlot = TIME_SLOT_MAP[cluster.preferredTime] || TIME_SLOT_MAP.morning;

  // Schedule for tomorrow (or next available weekday)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  // Skip weekends
  while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }
  const dateStr = tomorrow.toISOString().split("T")[0];

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      title: `Auto-Session at ${venue.name}`,
      date: dateStr,
      start_time: timeSlot.start,
      session_format: timeSlot.format,
      location_id: venue.id,
      neighborhood: cluster.neighborhood,
      max_spots: Math.min(cluster.requests.length + 2, 8), // room for walk-ins
      auto_created: true,
      demand_cluster_key: cluster.clusterKey,
      created_by: captainId,
      status: "upcoming",
    })
    .select("id")
    .single();

  if (error || !event) return null;
  return event.id;
}

/**
 * Mark requests as fulfilled and auto-RSVP users to the created event.
 */
async function fulfillRequests(
  requestIds: string[],
  eventId: string,
  userIds: string[]
): Promise<void> {
  // Mark requests as fulfilled
  await supabase
    .from("session_requests")
    .update({ status: "fulfilled" })
    .in("id", requestIds);

  // Auto-RSVP all requesters
  const rsvps = userIds.map((userId) => ({
    event_id: eventId,
    user_id: userId,
    status: "going",
  }));

  await supabase.from("event_rsvps").upsert(rsvps, { onConflict: "event_id,user_id" });

  // Create in-app notifications
  const notifications = userIds.map((userId) => ({
    user_id: userId,
    type: "session_auto_created",
    title: "Session created from your request!",
    body: "Enough people want to work together — we auto-created a session for you.",
    data: { event_id: eventId },
    read: false,
  }));

  await supabase.from("notifications").insert(notifications);
}

/**
 * Main entry point: check all pending demand and create sessions where clusters exist.
 * Returns a summary of what was created.
 */
export async function checkDemandAndCreateSessions(): Promise<AutoSessionResult> {
  const result: AutoSessionResult = { created: 0, errors: [], sessions: [] };

  const clusters = await findDemandClusters();
  if (clusters.length === 0) return result;

  for (const cluster of clusters) {
    // Check if we already created a session for this cluster
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("demand_cluster_key", cluster.clusterKey)
      .eq("auto_created", true)
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Find the most-requested venue, or pick the best one
    const venueVotes = new Map<string, number>();
    for (const r of cluster.requests) {
      if (r.venue_preference) {
        venueVotes.set(r.venue_preference, (venueVotes.get(r.venue_preference) || 0) + 1);
      }
    }
    const topVenueId = venueVotes.size > 0
      ? [...venueVotes.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;

    const venue = await pickBestVenue(cluster.neighborhood, topVenueId);
    if (!venue) {
      result.errors.push(`No venue found in ${cluster.neighborhood}`);
      continue;
    }

    const userIds = cluster.requests.map((r) => r.user_id);
    const captainId = await pickTableCaptain(userIds);
    if (!captainId) {
      result.errors.push(`No captain candidate for ${cluster.clusterKey}`);
      continue;
    }

    const eventId = await createAutoEvent(cluster, venue, captainId);
    if (!eventId) {
      result.errors.push(`Failed to create event for ${cluster.clusterKey}`);
      continue;
    }

    await fulfillRequests(
      cluster.requests.map((r) => r.id),
      eventId,
      userIds
    );

    result.created++;
    result.sessions.push({
      eventId,
      neighborhood: cluster.neighborhood,
      venue: venue.name,
      attendees: userIds.length,
    });
  }

  return result;
}

// ─── Event-Based Trigger ─────────────────────

/**
 * Call this immediately after inserting a new session_request.
 * Delegates to server_check_demand_cluster RPC which atomically:
 * 1. Checks if cluster threshold (3+) is met
 * 2. Creates event + RSVPs + notifications in one transaction
 * 3. Prevents race conditions (two clients triggering simultaneously)
 *
 * Returns the event ID if a session was created, null otherwise.
 */
export async function onNewSessionRequest(
  neighborhood: string,
  preferredTime: string
): Promise<string | null> {
  const normalizedNeighborhood = normalizeNeighborhood(neighborhood);

  const { data, error } = await supabase.rpc("server_check_demand_cluster", {
    p_neighborhood: normalizedNeighborhood,
    p_preferred_time: preferredTime,
  });

  if (error) {
    console.error("[autoSession] server_check_demand_cluster error:", error);
    return null;
  }

  const result = data as { created: boolean; event_id?: string; reason?: string };
  return result.created ? (result.event_id ?? null) : null;
}
