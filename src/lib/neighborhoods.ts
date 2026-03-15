/**
 * @module neighborhoods
 * @description Dynamic neighborhood system. Normalizes neighborhood strings so
 * "HSR Layout", "hsr_layout", "hsr layout" all match. Fetches neighborhoods
 * dynamically from the DB so the system works in any city/country.
 *
 * Key exports:
 * - normalizeNeighborhood() — Canonical slug: "HSR Layout" → "hsr-layout"
 * - displayNeighborhood() — "hsr-layout" → "Hsr Layout"
 * - fetchNeighborhoods() — Dynamic list from profiles + neighborhood_stats
 * - useNeighborhoods() — React hook for neighborhood autocomplete
 * - SEED_NEIGHBORHOODS — Initial Bangalore neighborhoods (bootstrap only)
 *
 * Design: International-ready. No hardcoded city list. Neighborhoods self-register
 * when users sign up. The seed list bootstraps Bangalore launch; after that, any
 * neighborhood typed by any user in any city becomes available.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Normalization ──────────────────────────

/**
 * Normalize a neighborhood string to a canonical slug.
 * "HSR Layout" → "hsr-layout"
 * "hsr_layout" → "hsr-layout"
 * "  Koramangala 5th Block  " → "koramangala-5th-block"
 *
 * WHY normalization is critical: We had a launch-blocking bug where Onboarding stored
 * "HSR Layout" (display name) but SessionRequests stored "hsr_layout" (underscore slug).
 * These never matched in demand clustering, so auto-sessions never triggered despite
 * real demand. ALL neighborhood comparisons MUST go through this function.
 * See CLAUDE.md "Key Architectural Decisions #1" for the full incident writeup.
 */
export function normalizeNeighborhood(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")      // spaces and underscores → hyphens
    .replace(/[^a-z0-9\-]/g, "")  // strip non-alphanumeric (except hyphens)
    .replace(/-+/g, "-")          // collapse multiple hyphens
    .replace(/^-|-$/g, "");       // trim leading/trailing hyphens
}

/**
 * Convert a normalized slug back to display form.
 * "hsr-layout" → "HSR Layout" (uses known display names first, then title-cases)
 */
export function displayNeighborhood(slug: string): string {
  // Check known display names first
  const known = SEED_NEIGHBORHOODS.find((n) => n.slug === slug);
  if (known) return known.display;

  // Title-case fallback
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Seed Data (Bangalore bootstrap) ────────

export interface NeighborhoodOption {
  slug: string;    // normalized key stored in DB
  display: string; // human-readable name
}

/**
 * Initial neighborhoods for Bangalore launch. After launch, neighborhoods
 * self-register from user profiles. This list just prevents a cold start.
 *
 * WHY seed neighborhoods exist: Without seeds, the autocomplete is empty on day 1.
 * New users in Bangalore would have to type their neighborhood freeform, leading to
 * inconsistent entries ("HSR", "HSR Layout", "H.S.R. Layout"). Seeds provide canonical
 * display names and ensure consistent slugs from the very first signup.
 * Intentionally limited to Bangalore — other cities self-populate via user profiles.
 */
export const SEED_NEIGHBORHOODS: NeighborhoodOption[] = [
  { slug: "hsr-layout", display: "HSR Layout" },
  { slug: "koramangala", display: "Koramangala" },
  { slug: "indiranagar", display: "Indiranagar" },
  { slug: "btm-layout", display: "BTM Layout" },
  { slug: "jp-nagar", display: "JP Nagar" },
  { slug: "jayanagar", display: "Jayanagar" },
  { slug: "whitefield", display: "Whitefield" },
  { slug: "electronic-city", display: "Electronic City" },
  { slug: "marathahalli", display: "Marathahalli" },
  { slug: "sarjapur-road", display: "Sarjapur Road" },
];

// ─── Dynamic Fetching ───────────────────────

/**
 * Fetch all known neighborhoods from the DB. Merges:
 * 1. Distinct neighborhoods from profiles (where users actually are)
 * 2. Neighborhoods from neighborhood_stats (tracked areas)
 * 3. Seed neighborhoods (bootstrap fallback)
 *
 * Returns deduplicated, sorted list of {slug, display} pairs.
 */
export async function fetchNeighborhoods(): Promise<NeighborhoodOption[]> {
  const seen = new Map<string, string>(); // slug → display

  // Add seeds first (lowest priority — overridden by DB data)
  for (const seed of SEED_NEIGHBORHOODS) {
    seen.set(seed.slug, seed.display);
  }

  // Fetch from neighborhood_stats
  const { data: stats } = await supabase
    .from("neighborhood_stats")
    .select("neighborhood");

  if (stats) {
    for (const row of stats) {
      const slug = normalizeNeighborhood(row.neighborhood);
      if (slug && !seen.has(slug)) {
        seen.set(slug, displayNeighborhood(slug));
      }
    }
  }

  // Fetch distinct neighborhoods from profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("neighborhood")
    .not("neighborhood", "is", null)
    .not("neighborhood", "eq", "");

  if (profiles) {
    const uniqueRaw = new Set(profiles.map((p: any) => p.neighborhood as string));
    for (const raw of uniqueRaw) {
      const slug = normalizeNeighborhood(raw);
      if (slug && !seen.has(slug)) {
        // Use the raw DB value as display if it looks reasonable
        seen.set(slug, raw.trim());
      }
    }
  }

  return [...seen.entries()]
    .map(([slug, display]) => ({ slug, display }))
    .sort((a, b) => a.display.localeCompare(b.display));
}

// ─── React Hook ─────────────────────────────

/**
 * Hook for neighborhood autocomplete. Returns a list of neighborhoods
 * and a filtered subset based on search query.
 */
export function useNeighborhoods() {
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodOption[]>(SEED_NEIGHBORHOODS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNeighborhoods().then((result) => {
      setNeighborhoods(result);
      setLoading(false);
    });
  }, []);

  const search = (query: string): NeighborhoodOption[] => {
    if (!query.trim()) return neighborhoods;
    const q = query.toLowerCase();
    return neighborhoods.filter(
      (n) => n.display.toLowerCase().includes(q) || n.slug.includes(q)
    );
  };

  return { neighborhoods, search, loading };
}

// ─── Migration Helper ───────────────────────

/**
 * Normalize a raw neighborhood value from the DB to its canonical slug.
 * Handles legacy formats: "hsr_layout", "HSR Layout", "hsr-layout" all → "hsr-layout"
 */
export function migrateNeighborhoodValue(raw: string | null): string {
  if (!raw) return "";
  return normalizeNeighborhood(raw);
}
