import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, Zap, Coffee, VolumeX, Maximize } from "lucide-react";

export interface VenueBadge {
  key: string;
  label: string;
  icon: typeof Wifi;
  avg: number;
}

const BADGE_CONFIG = [
  { key: "wifi_quality", label: "WiFi", icon: Wifi },
  { key: "power_outlets", label: "Power", icon: Zap },
  { key: "coffee_quality", label: "Coffee", icon: Coffee },
  { key: "noise_level", label: "Quiet", icon: VolumeX },
  { key: "seating_comfort", label: "Spacious", icon: Maximize },
] as const;

interface VenueRatingData {
  venue_name: string;
  noise_level: number | null;
  wifi_quality: number | null;
  power_outlets: number | null;
  coffee_quality: number | null;
  seating_comfort: number | null;
}

/**
 * Fetches venue badges for multiple venues in a single query.
 * Returns a Map<venueName, VenueBadge[]> so parent components can
 * pass pre-fetched data to VenueQuickBadges, avoiding N+1 queries.
 */
export function useVenueBadgesBatch(venueNames: string[]): {
  badgeMap: Map<string, VenueBadge[]>;
  loading: boolean;
} {
  const [badgeMap, setBadgeMap] = useState<Map<string, VenueBadge[]>>(new Map());
  const [loading, setLoading] = useState(false);

  // Stable key to avoid re-fetching on every render when array contents are the same
  const sortedKey = [...new Set(venueNames.filter(Boolean))].sort().join(",");

  useEffect(() => {
    const uniqueNames = [...new Set(venueNames.filter(Boolean))];
    if (uniqueNames.length === 0) {
      setBadgeMap(new Map());
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data } = await supabase
        .from("venue_vibes")
        .select("venue_name, noise_level, wifi_quality, power_outlets, coffee_quality, seating_comfort")
        .in("venue_name", uniqueNames);

      if (cancelled) return;

      const result = new Map<string, VenueBadge[]>();

      if (!data || data.length === 0) {
        setBadgeMap(result);
        setLoading(false);
        return;
      }

      // Group rows by venue_name
      const grouped = new Map<string, VenueRatingData[]>();
      for (const row of data as VenueRatingData[]) {
        const existing = grouped.get(row.venue_name) || [];
        existing.push(row);
        grouped.set(row.venue_name, existing);
      }

      // Compute badges per venue (same logic as VenueQuickBadges)
      for (const [venueName, rows] of grouped) {
        const badges: VenueBadge[] = [];

        for (const config of BADGE_CONFIG) {
          const vals = rows
            .map((d) => d[config.key as keyof VenueRatingData] as number | null)
            .filter((v): v is number => v !== null && v !== undefined);

          if (vals.length === 0) continue;

          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          if (avg >= 4) {
            badges.push({
              key: config.key,
              label: config.label,
              icon: config.icon,
              avg: Math.round(avg * 10) / 10,
            });
          }
        }

        result.set(venueName, badges);
      }

      setBadgeMap(result);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [sortedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { badgeMap, loading };
}
