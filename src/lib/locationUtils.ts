/**
 * @module locationUtils
 * @description Location detection and city inference for global expansion.
 * Replaces all hardcoded "Bangalore" references with dynamic detection.
 *
 * WHY this module exists: DanaDone launched in Bangalore, and the codebase had
 * "Bangalore" hardcoded in 7+ UI files. For organic global growth, every location
 * reference must be dynamic — either inferred from the user's neighborhood, detected
 * via browser geolocation, or omitted entirely for unknown locations.
 *
 * Key exports:
 * - detectUserLocation()      — Browser geolocation → {lat, lng} (returns null if denied)
 * - reverseGeocode()          — Lat/lng → {neighborhood, city, country} via free Nominatim (OSM)
 * - inferCityFromNeighborhood()— Slug → city name (instant, from known mapping + DB cache)
 * - getLocationLabel()        — User-facing location label for UI copy
 * - haversineKm()             — Great-circle distance between two lat/lng pairs
 * - isNeighborhoodNearby()    — Check if two neighborhoods are within a radius
 *
 * Dependencies: Supabase client (for DB city lookups)
 * Tables read: neighborhood_stats (city column), profiles (preferred_latitude/longitude)
 */
import { supabase } from "@/integrations/supabase/client";
import { normalizeNeighborhood, SEED_NEIGHBORHOODS } from "@/lib/neighborhoods";

// ─── Known City Mappings ────────────────────────────────
// WHY a static map: Seed neighborhoods are Bangalore-only (bootstrap city).
// For these 10 neighborhoods, we know the city instantly without a DB call.
// All other neighborhoods look up city from neighborhood_stats or profile data.
const SEED_CITY_MAP: Record<string, string> = Object.fromEntries(
  SEED_NEIGHBORHOODS.map((n) => [n.slug, "Bangalore"])
);

// In-memory cache for DB-resolved city lookups (avoids repeated queries).
// Bounded to 200 entries — neighborhoods grow slowly so this won't leak.
const cityCache = new Map<string, string | null>();
const CITY_CACHE_MAX = 200;

// ─── Browser Geolocation ────────────────────────────────

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number; // meters
}

/**
 * Request the user's location from the browser.
 * Returns null if geolocation is unavailable, denied, or times out.
 *
 * WHY enableHighAccuracy=false + 10s timeout: High accuracy uses GPS which
 * drains battery and takes 10-30s on some devices. For neighborhood-level
 * detection, WiFi/cell tower accuracy (~100m) is sufficient. 10s timeout
 * prevents blocking the UI — if location takes longer, we fall back to manual input.
 */
export function detectUserLocation(): Promise<GeoPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

// ─── Reverse Geocoding ──────────────────────────────────

export interface GeocodedLocation {
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
}

/**
 * Convert lat/lng to a human-readable location using OpenStreetMap Nominatim.
 *
 * WHY Nominatim: Free, no API key required, covers the entire world.
 * Rate limit: 1 req/sec (we only call this during onboarding, so well within limits).
 * Zoom=16 gives neighborhood-level detail (vs zoom=10 for city-level).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedLocation | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=16`,
      {
        headers: {
          // WHY User-Agent: Nominatim requires it per their usage policy.
          // Without it, requests get blocked after a few calls.
          "User-Agent": "DanaDone/1.0 (https://danadone.club)",
        },
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const addr = data.address || {};

    return {
      // WHY this priority: Nominatim returns different fields for different regions.
      // In India: suburb > neighbourhood. In US: neighbourhood > suburb.
      // We check all variants to work globally.
      neighborhood: addr.suburb || addr.neighbourhood || addr.quarter || addr.village || addr.hamlet,
      city: addr.city || addr.town || addr.municipality || addr.state_district,
      state: addr.state,
      country: addr.country,
      countryCode: addr.country_code?.toUpperCase(),
    };
  } catch {
    return null;
  }
}

// ─── City Inference ─────────────────────────────────────

/**
 * Infer the city for a neighborhood slug. Checks (in order):
 * 1. Known seed map (instant, no network)
 * 2. In-memory cache (instant)
 * 3. neighborhood_stats table (1 query, then cached)
 *
 * Returns null if the city is unknown — callers should handle gracefully
 * by omitting city from display rather than showing "Unknown".
 */
export async function inferCityFromNeighborhood(slug: string): Promise<string | null> {
  const normalized = normalizeNeighborhood(slug);

  // 1. Seed map (Bangalore neighborhoods)
  if (SEED_CITY_MAP[normalized]) return SEED_CITY_MAP[normalized];

  // 2. In-memory cache
  if (cityCache.has(normalized)) return cityCache.get(normalized) ?? null;

  // 3. DB lookup
  try {
    const { data } = await supabase
      .from("neighborhood_stats")
      .select("city")
      .eq("neighborhood", normalized)
      .maybeSingle();

    const city = (data as { city?: string } | null)?.city ?? null;

    // Cache the result (bounded)
    if (cityCache.size >= CITY_CACHE_MAX) {
      // Evict oldest entry (first inserted)
      const firstKey = cityCache.keys().next().value;
      if (firstKey !== undefined) cityCache.delete(firstKey);
    }
    cityCache.set(normalized, city);

    return city;
  } catch {
    return null;
  }
}

/**
 * Synchronous city lookup — only checks seed map and cache.
 * Use this in render paths where async isn't possible.
 * Returns null if city not yet resolved (caller should use inferCityFromNeighborhood
 * in an effect and cache the result in state).
 */
export function inferCitySync(slug: string): string | null {
  const normalized = normalizeNeighborhood(slug);
  return SEED_CITY_MAP[normalized] ?? cityCache.get(normalized) ?? null;
}

// ─── Location Labels ────────────────────────────────────

/**
 * Generate a user-facing location label for UI copy.
 * Replaces hardcoded "Bangalore" throughout the app.
 *
 * Returns patterns like:
 * - "HSR Layout, Bangalore" (known city)
 * - "HSR Layout" (unknown city — just neighborhood)
 * - "your area" (no neighborhood available — generic fallback)
 *
 * WHY "your area" fallback: Better than showing "Unknown" or empty string.
 * Creates a personal connection: "People in your area" > "People in null".
 */
export function getLocationLabel(
  neighborhoodDisplay: string | null,
  city: string | null
): string {
  if (neighborhoodDisplay && city) return `${neighborhoodDisplay}, ${city}`;
  if (neighborhoodDisplay) return neighborhoodDisplay;
  return "your area";
}

/**
 * Generate a short location label for compact UI (nav bars, badges).
 * Prefers neighborhood name only, falls back to city.
 */
export function getShortLocationLabel(
  neighborhoodDisplay: string | null,
  city: string | null
): string {
  return neighborhoodDisplay || city || "your area";
}

// ─── Distance Calculation ───────────────────────────────

/**
 * Haversine great-circle distance between two points in km.
 *
 * WHY Haversine over Vincenty: For distances < 500km (neighborhood-level),
 * Haversine error is < 0.3%. Vincenty is more accurate for antipodal points
 * but overkill for "are these two neighborhoods nearby?" checks.
 */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if two geographic points are within a given radius.
 * Used for cross-neighborhood matching in sparse areas.
 */
export function isWithinRadius(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  radiusKm: number
): boolean {
  return haversineKm(lat1, lng1, lat2, lng2) <= radiusKm;
}

// ─── Neighborhood Activation Helpers ────────────────────

export interface NeighborhoodActivationStatus {
  neighborhood: string;
  memberCount: number;
  threshold: number;
  isUnlocked: boolean;
  progressPercent: number;
  membersNeeded: number;
}

/**
 * Get activation status for a neighborhood.
 * Used by the NeighborhoodActivationCard to show progress.
 *
 * WHY this lives in locationUtils (not venueNomination): The activation
 * progress is displayed on the home page and neighborhood landing pages —
 * it's a location concern, not a venue concern. venueNomination handles
 * what happens AFTER unlock (nominations, vouches).
 */
export async function getNeighborhoodActivationStatus(
  neighborhoodSlug: string,
  threshold: number
): Promise<NeighborhoodActivationStatus> {
  const normalized = normalizeNeighborhood(neighborhoodSlug);

  // Count distinct members in this neighborhood
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("neighborhood", normalized)
    .eq("onboarding_completed", true);

  const memberCount = count ?? 0;
  const isUnlocked = memberCount >= threshold;

  return {
    neighborhood: normalized,
    memberCount,
    threshold,
    isUnlocked,
    progressPercent: Math.min(100, Math.round((memberCount / threshold) * 100)),
    membersNeeded: Math.max(0, threshold - memberCount),
  };
}
