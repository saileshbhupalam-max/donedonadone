/**
 * @module venueNomination
 * @description Permissionless venue nomination and peer-verification system.
 * Members nominate venues, others vouch, 3 vouches + unlocked neighborhood → verified.
 *
 * Key exports:
 * - nominateVenue() — Submit a new venue nomination, award FC
 * - vouchForVenue() — Vouch for an existing nomination, check activation
 * - activateVenue() — Promote verified nomination to locations table
 * - getNominations() — Get nominations for a neighborhood
 * - getNeighborhoodReadiness() — Member count, unlock status, nominations
 * - getUserNominations() — Get nominations by a specific user
 *
 * Dependencies: Supabase client, focusCredits, growthConfig
 * Tables: venue_nominations, venue_vouches, neighborhood_stats, locations
 */
import { supabase } from "@/integrations/supabase/client";
import { awardCredits } from "@/lib/focusCredits";
import { normalizeNeighborhood } from "@/lib/neighborhoods";

// ─── Types ──────────────────────────────────

export interface NominationData {
  venue_name: string;
  address: string;
  neighborhood: string;
  latitude?: number;
  longitude?: number;
  photo_url?: string;
  photo_gps_lat?: number;
  photo_gps_lng?: number;
  google_maps_url?: string;
  wifi_available?: boolean;
}

export interface VouchData {
  wifi_works?: boolean;
  has_power_outlets?: boolean;
  has_adequate_seating?: boolean;
  noise_level?: "quiet" | "moderate" | "lively";
  photo_proof_url?: string;
  comment?: string;
}

export interface Nomination {
  id: string;
  nominated_by: string;
  venue_name: string;
  address: string | null;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  google_maps_url: string | null;
  wifi_available: boolean;
  status: string;
  vouch_count: number;
  location_id: string | null;
  created_at: string;
  nominator_name?: string;
  nominator_avatar?: string;
}

export interface NeighborhoodReadiness {
  memberCount: number;
  threshold: number;
  isUnlocked: boolean;
  nominations: Nomination[];
  activeVenues: number;
}

// ─── Core Functions ──────────────────────────

/**
 * Submit a new venue nomination. Awards 30 FC (add_new_venue action).
 */
export async function nominateVenue(
  userId: string,
  data: NominationData
): Promise<{ success: boolean; nominationId?: string; creditsAwarded: number; error?: string }> {
  // Normalize neighborhood for consistent matching
  const neighborhood = normalizeNeighborhood(data.neighborhood);
  if (!neighborhood) {
    return { success: false, creditsAwarded: 0, error: "Neighborhood is required" };
  }

  // Check neighborhood is unlocked
  const readiness = await getNeighborhoodReadiness(neighborhood);
  if (!readiness.isUnlocked) {
    return {
      success: false,
      creditsAwarded: 0,
      error: `${data.neighborhood} needs ${readiness.threshold - readiness.memberCount} more members to unlock nominations`,
    };
  }

  // Check for duplicate nomination by same user in same neighborhood
  const { data: existing } = await supabase
    .from("venue_nominations")
    .select("id")
    .eq("nominated_by", userId)
    .eq("venue_name", data.venue_name)
    .eq("neighborhood", neighborhood)
    .limit(1);

  if (existing && existing.length > 0) {
    return { success: false, creditsAwarded: 0, error: "You already nominated this venue" };
  }

  // Insert nomination
  const { data: nomination, error } = await supabase
    .from("venue_nominations")
    .insert({
      nominated_by: userId,
      venue_name: data.venue_name,
      address: data.address,
      neighborhood,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      photo_url: data.photo_url ?? null,
      photo_gps_lat: data.photo_gps_lat ?? null,
      photo_gps_lng: data.photo_gps_lng ?? null,
      google_maps_url: data.google_maps_url ?? null,
      wifi_available: data.wifi_available ?? false,
    })
    .select("id")
    .single();

  if (error || !nomination) {
    return { success: false, creditsAwarded: 0, error: error?.message || "Failed to create nomination" };
  }

  // Award FC for nominating
  const creditResult = await awardCredits(userId, "add_new_venue", 30, {
    venue_id: nomination.id,
  });

  return {
    success: true,
    nominationId: nomination.id,
    creditsAwarded: creditResult.awarded,
  };
}

/**
 * Vouch for an existing nomination. Awards 3 FC (verify_venue_info action).
 * Calls check_nomination_activation() RPC to see if 3-vouch threshold is met.
 */
export async function vouchForVenue(
  userId: string,
  nominationId: string,
  data: VouchData
): Promise<{ success: boolean; activated: boolean; creditsAwarded: number; error?: string }> {
  // Quality gate: voucher must have attended at least 1 session (prevents fake accounts)
  const { data: voucherProfile } = await supabase
    .from("profiles")
    .select("events_attended")
    .eq("id", userId)
    .single();

  if (!voucherProfile || (voucherProfile.events_attended ?? 0) < 1) {
    return {
      success: false,
      activated: false,
      creditsAwarded: 0,
      error: "Attend at least 1 session before vouching for venues",
    };
  }

  // Insert vouch (RLS prevents vouching own nomination)
  const { error: vouchError } = await supabase
    .from("venue_vouches")
    .insert({
      nomination_id: nominationId,
      user_id: userId,
      wifi_works: data.wifi_works ?? null,
      has_power_outlets: data.has_power_outlets ?? null,
      has_adequate_seating: data.has_adequate_seating ?? null,
      noise_level: data.noise_level ?? null,
      photo_proof_url: data.photo_proof_url ?? null,
      comment: data.comment ?? null,
    });

  if (vouchError) {
    const msg = vouchError.message.includes("duplicate")
      ? "You already vouched for this venue"
      : vouchError.message.includes("new row violates")
        ? "You can't vouch for your own nomination"
        : vouchError.message;
    return { success: false, activated: false, creditsAwarded: 0, error: msg };
  }

  // Award FC for vouching
  const creditResult = await awardCredits(userId, "verify_venue_info", 3, {
    venue_id: nominationId,
  });

  // Check if nomination should activate (3 vouches + neighborhood unlocked)
  const { data: activated } = await supabase.rpc("check_nomination_activation", {
    p_nomination_id: nominationId,
  });

  // If activated, create the location entry
  if (activated) {
    await activateVenue(nominationId);
  }

  return {
    success: true,
    activated: !!activated,
    creditsAwarded: creditResult.awarded,
  };
}

/**
 * Promote a verified nomination to the locations table.
 * Awards big FC bonus (30) to the original nominator.
 */
export async function activateVenue(nominationId: string): Promise<boolean> {
  // Get nomination details
  const { data: nomination } = await supabase
    .from("venue_nominations")
    .select("*")
    .eq("id", nominationId)
    .single();

  if (!nomination || nomination.location_id) return false;

  // Create location entry
  const { data: location, error } = await supabase
    .from("locations")
    .insert({
      name: nomination.venue_name,
      address: nomination.address,
      neighborhood: nomination.neighborhood,
      latitude: nomination.latitude,
      longitude: nomination.longitude,
      location_type: "cafe", // default; can be updated later
      wifi_available: nomination.wifi_available,
      photo_url: nomination.photo_url,
      google_maps_url: nomination.google_maps_url,
    })
    .select("id")
    .single();

  if (error || !location) return false;

  // Link location to nomination and mark as active
  await supabase
    .from("venue_nominations")
    .update({
      location_id: location.id,
      status: "active",
      activated_at: new Date().toISOString(),
    })
    .eq("id", nominationId);

  // Update neighborhood stats
  await supabase.rpc("update_neighborhood_stats", {
    p_neighborhood: nomination.neighborhood,
  });

  // Award bonus FC to the nominator for successful activation
  await awardCredits(nomination.nominated_by, "add_new_venue", 30, {
    venue_id: location.id,
    activation_bonus: true,
  } as any);

  return true;
}

/**
 * Get all nominations for a neighborhood with nominator info.
 */
export async function getNominations(
  neighborhood: string,
  status?: string
): Promise<Nomination[]> {
  const normalized = normalizeNeighborhood(neighborhood);
  let query = supabase
    .from("venue_nominations")
    .select("*, profiles:nominated_by(display_name, avatar_url)")
    .eq("neighborhood", normalized)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data } = await query;
  if (!data) return [];

  return data.map((n: any) => ({
    ...n,
    nominator_name: n.profiles?.display_name || "Anonymous",
    nominator_avatar: n.profiles?.avatar_url || null,
  }));
}

/**
 * Get neighborhood readiness: member count vs threshold, unlock status, nominations.
 */
export async function getNeighborhoodReadiness(
  neighborhood: string
): Promise<NeighborhoodReadiness> {
  const THRESHOLD = 10;
  const normalized = normalizeNeighborhood(neighborhood);

  // Check cached stats first
  const { data: stats } = await supabase
    .from("neighborhood_stats")
    .select("member_count, active_venues, is_unlocked")
    .eq("neighborhood", normalized)
    .maybeSingle();

  if (stats) {
    const nominations = await getNominations(neighborhood);
    return {
      memberCount: stats.member_count,
      threshold: THRESHOLD,
      isUnlocked: stats.is_unlocked,
      nominations,
      activeVenues: stats.active_venues,
    };
  }

  // No cached stats — compute from profiles
  const { count: memberCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("neighborhood", normalized);

  const actualCount = memberCount ?? 0;
  const isUnlocked = actualCount >= THRESHOLD;

  // Update the stats cache
  await supabase.rpc("update_neighborhood_stats", { p_neighborhood: normalized });

  const nominations = await getNominations(normalized);

  return {
    memberCount: actualCount,
    threshold: THRESHOLD,
    isUnlocked,
    nominations,
    activeVenues: nominations.filter((n) => n.status === "active").length,
  };
}

/**
 * Get nominations created by a specific user.
 */
export async function getUserNominations(userId: string): Promise<Nomination[]> {
  const { data } = await supabase
    .from("venue_nominations")
    .select("*")
    .eq("nominated_by", userId)
    .order("created_at", { ascending: false });

  return (data as Nomination[]) || [];
}

/**
 * Get vouches for a specific nomination.
 */
export async function getVouchesForNomination(
  nominationId: string
): Promise<Array<VouchData & { user_id: string; display_name: string; created_at: string }>> {
  const { data } = await supabase
    .from("venue_vouches")
    .select("*, profiles:user_id(display_name)")
    .eq("nomination_id", nominationId)
    .order("created_at", { ascending: true });

  if (!data) return [];

  return data.map((v: any) => ({
    ...v,
    display_name: v.profiles?.display_name || "Anonymous",
  }));
}

// ─── Ring Detection ──────────────────────────

/**
 * Detect nomination ring patterns: A nominates, B/C/D vouch, then B nominates
 * and A/C/D vouch — a reciprocal group gaming the vouch system.
 *
 * How it works: For a given user, find all users who vouched for their
 * nominations AND whose nominations they vouched for. If any pair has
 * reciprocal vouch relationships, flag it.
 *
 * Returns: Array of {userId, partnerId} pairs that form rings.
 * Empty array = no suspicious activity detected.
 */
export async function detectNominationRings(
  neighborhood: string
): Promise<Array<{ userId: string; partnerId: string; nominationCount: number }>> {
  const normalized = normalizeNeighborhood(neighborhood);

  // Get all nominations and their vouches in this neighborhood
  const { data: nominations } = await supabase
    .from("venue_nominations")
    .select("id, nominated_by")
    .eq("neighborhood", normalized)
    .in("status", ["nominated", "verified", "active"]);

  if (!nominations || nominations.length === 0) return [];

  const nominationIds = nominations.map((n) => n.id);

  const { data: vouches } = await supabase
    .from("venue_vouches")
    .select("nomination_id, user_id")
    .in("nomination_id", nominationIds);

  if (!vouches || vouches.length === 0) return [];

  // Build a map: nominator → set of vouchers
  const nominatorToVouchers = new Map<string, Set<string>>();
  for (const nom of nominations) {
    if (!nominatorToVouchers.has(nom.nominated_by)) {
      nominatorToVouchers.set(nom.nominated_by, new Set());
    }
  }
  for (const v of vouches) {
    const nom = nominations.find((n) => n.id === v.nomination_id);
    if (nom) {
      nominatorToVouchers.get(nom.nominated_by)?.add(v.user_id);
    }
  }

  // Detect reciprocal pairs: A vouched for B's nomination AND B vouched for A's
  const rings: Array<{ userId: string; partnerId: string; nominationCount: number }> = [];
  const checked = new Set<string>();

  for (const [userA, vouchersOfA] of nominatorToVouchers) {
    for (const voucherB of vouchersOfA) {
      const pairKey = [userA, voucherB].sort().join("__");
      if (checked.has(pairKey)) continue;
      checked.add(pairKey);

      // Does B also have nominations that A vouched for?
      const vouchersOfB = nominatorToVouchers.get(voucherB);
      if (vouchersOfB?.has(userA)) {
        // Count how many nominations are involved
        const aNomsVouchedByB = nominations.filter(
          (n) => n.nominated_by === userA && vouches.some((v) => v.nomination_id === n.id && v.user_id === voucherB)
        ).length;
        const bNomsVouchedByA = nominations.filter(
          (n) => n.nominated_by === voucherB && vouches.some((v) => v.nomination_id === n.id && v.user_id === userA)
        ).length;

        rings.push({
          userId: userA,
          partnerId: voucherB,
          nominationCount: aNomsVouchedByB + bNomsVouchedByA,
        });
      }
    }
  }

  return rings;
}
