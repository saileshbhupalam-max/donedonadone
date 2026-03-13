/* DESIGN: Venue intelligence badges surface crowdsourced quality signals
   directly on event cards. Only high-rated categories (>=4/5) appear,
   acting as positive trust signals rather than full rating displays. */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, Zap, Coffee, VolumeX, Maximize } from "lucide-react";

interface VenueQuickBadgesProps {
  venueName: string;
}

interface VenueRatingData {
  noise_level: number | null;
  wifi_quality: number | null;
  power_outlets: number | null;
  coffee_quality: number | null;
  seating_comfort: number | null;
}

const BADGE_CONFIG = [
  { key: "wifi_quality", label: "WiFi", icon: Wifi },
  { key: "power_outlets", label: "Power", icon: Zap },
  { key: "coffee_quality", label: "Coffee", icon: Coffee },
  { key: "noise_level", label: "Quiet", icon: VolumeX },
  { key: "seating_comfort", label: "Spacious", icon: Maximize },
] as const;

// Simple in-memory cache to avoid re-fetching per card
const badgeCache = new Map<string, { badges: Array<{ key: string; label: string; icon: typeof Wifi; avg: number }>; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function VenueQuickBadges({ venueName }: VenueQuickBadgesProps) {
  const [badges, setBadges] = useState<Array<{ key: string; label: string; icon: typeof Wifi; avg: number }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!venueName) return;

    const cached = badgeCache.get(venueName);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setBadges(cached.badges);
      setLoaded(true);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("venue_vibes")
        .select("noise_level, wifi_quality, power_outlets, coffee_quality, seating_comfort")
        .eq("venue_name", venueName);

      if (!data || data.length === 0) {
        setLoaded(true);
        return;
      }

      const result: Array<{ key: string; label: string; icon: typeof Wifi; avg: number }> = [];

      for (const config of BADGE_CONFIG) {
        const vals = data
          .map((d: VenueRatingData) => d[config.key as keyof VenueRatingData])
          .filter((v): v is number => v !== null && v !== undefined);

        if (vals.length === 0) continue;

        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        if (avg >= 4) {
          result.push({
            key: config.key,
            label: config.label,
            icon: config.icon,
            avg: Math.round(avg * 10) / 10,
          });
        }
      }

      badgeCache.set(venueName, { badges: result, timestamp: Date.now() });
      setBadges(result);
      setLoaded(true);
    })();
  }, [venueName]);

  if (!loaded || badges.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {badges.map((badge) => {
        const Icon = badge.icon;
        return (
          <span
            key={badge.key}
            className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            <Icon className="w-3 h-3" />
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}

/* VenueIntelligencePanel — detailed breakdown for EventDetail page */

interface VenueIntelligencePanelProps {
  venueName: string;
  eventId?: string;
  userId?: string;
  hasAttended?: boolean;
}

interface CategoryRating {
  key: string;
  label: string;
  icon: typeof Wifi;
  avg: number;
  count: number;
}

export function VenueIntelligencePanel({ venueName, hasAttended }: VenueIntelligencePanelProps) {
  const [categories, setCategories] = useState<CategoryRating[]>([]);
  const [totalRatings, setTotalRatings] = useState(0);
  const [dominantVibe, setDominantVibe] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!venueName) return;

    (async () => {
      const { data } = await supabase
        .from("venue_vibes")
        .select("noise_level, wifi_quality, power_outlets, coffee_quality, seating_comfort, overall_vibe")
        .eq("venue_name", venueName);

      if (!data || data.length === 0) {
        setLoaded(true);
        return;
      }

      setTotalRatings(data.length);

      const result: CategoryRating[] = [];
      for (const config of BADGE_CONFIG) {
        const vals = data
          .map((d: any) => d[config.key])
          .filter((v: any): v is number => v !== null && v !== undefined);
        if (vals.length === 0) continue;
        const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
        result.push({
          key: config.key,
          label: config.label,
          icon: config.icon,
          avg: Math.round(avg * 10) / 10,
          count: vals.length,
        });
      }

      const vibes = data.map((d: any) => d.overall_vibe).filter(Boolean);
      const vibeCounts: Record<string, number> = {};
      vibes.forEach((v: string) => { vibeCounts[v] = (vibeCounts[v] || 0) + 1; });
      const dominant = Object.entries(vibeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      setDominantVibe(dominant);

      setCategories(result);
      setLoaded(true);
    })();
  }, [venueName]);

  if (!loaded || (categories.length === 0 && totalRatings === 0)) return null;

  const vibeLabels: Record<string, string> = {
    deep_focus: "Deep Focus",
    balanced: "Balanced",
    social: "Social",
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <p className="font-serif text-sm text-foreground">Venue Intelligence</p>
        <span className="text-[10px] text-muted-foreground">{totalRatings} rating{totalRatings !== 1 ? "s" : ""}</span>
      </div>

      {dominantVibe && (
        <p className="text-xs text-primary font-medium">
          Best for: {vibeLabels[dominantVibe] || dominantVibe}
        </p>
      )}

      <div className="space-y-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const pct = (cat.avg / 5) * 100;
          return (
            <div key={cat.key} className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground w-16">{cat.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-6 text-right">{cat.avg}</span>
            </div>
          );
        })}
      </div>

      {hasAttended && (
        <button
          className="text-xs text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            const el = document.getElementById("venue-vibe-rating");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Rate this venue
        </button>
      )}
    </div>
  );
}
