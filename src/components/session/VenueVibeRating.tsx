/* DESIGN: Venue vibes are crowdsourced — users trust peer data more than venue marketing.
   Quick 10-second rating after each session builds venue intelligence for the community. */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface VenueVibeRatingProps {
  eventId: string;
  userId: string;
  venueName: string;
  onDone: () => void;
}

const RATING_ITEMS = [
  { key: "noise_level", emoji: "🔇", label: "Noise" },
  { key: "wifi_quality", emoji: "📶", label: "WiFi" },
  { key: "power_outlets", emoji: "🔌", label: "Power" },
  { key: "coffee_quality", emoji: "☕", label: "Coffee" },
  { key: "seating_comfort", emoji: "💺", label: "Comfort" },
] as const;

const VIBE_OPTIONS = [
  { value: "deep_focus", emoji: "🎯", label: "Deep Focus" },
  { value: "balanced", emoji: "⚖️", label: "Balanced" },
  { value: "social", emoji: "🎉", label: "Social" },
];

export function VenueVibeRating({ eventId, userId, venueName, onDone }: VenueVibeRatingProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [overallVibe, setOverallVibe] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const setRating = (key: string, val: number) => {
    setRatings(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await supabase.from("venue_vibes").upsert({
        user_id: userId,
        event_id: eventId,
        venue_name: venueName,
        noise_level: ratings.noise_level || null,
        wifi_quality: ratings.wifi_quality || null,
        power_outlets: ratings.power_outlets || null,
        coffee_quality: ratings.coffee_quality || null,
        seating_comfort: ratings.seating_comfort || null,
        overall_vibe: overallVibe,
        note: note.trim() || null,
      }, { onConflict: "user_id,event_id" });
      toast.success("Venue vibe saved! 🎯");
      onDone();
    } catch (err) {
      console.error("[VenueVibe]", err);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-4">
          <div>
            <p className="font-serif text-sm text-foreground">How was {venueName} for working?</p>
            <p className="text-[10px] text-muted-foreground">Quick rating — takes 10 seconds</p>
          </div>

          {/* Rating sliders */}
          <div className="space-y-3">
            {RATING_ITEMS.map(item => (
              <div key={item.key} className="flex items-center gap-2">
                <span className="text-sm w-6">{item.emoji}</span>
                <span className="text-xs text-muted-foreground w-16">{item.label}</span>
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} onClick={() => setRating(item.key, v)}
                      className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                        ratings[item.key] === v
                          ? "bg-primary text-primary-foreground"
                          : ratings[item.key] && ratings[item.key] >= v
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Overall vibe */}
          <div className="flex gap-2">
            {VIBE_OPTIONS.map(v => (
              <button key={v.value} onClick={() => setOverallVibe(v.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                  overallVibe === v.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}>
                {v.emoji} {v.label}
              </button>
            ))}
          </div>

          {/* Note */}
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value.slice(0, 100))}
            placeholder="Quick note (optional)"
            className="w-full text-xs bg-muted rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground outline-none"
          />

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={onDone}>Skip</Button>
            <Button size="sm" className="flex-1" onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* DESIGN: VenueVibeSummary shows crowdsourced venue data on event cards.
   Only appears with 3+ ratings — enough for statistical relevance. */
export function VenueVibeSummary({ venueName }: { venueName: string }) {
  const [summary, setSummary] = useState<{ avg: Record<string, number>; count: number; dominantVibe: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("venue_vibes")
        .select("noise_level, wifi_quality, power_outlets, coffee_quality, seating_comfort, overall_vibe")
        .eq("venue_name", venueName);
      if (!data || data.length < 3) return;

      const avg: Record<string, number> = {};
      const keys = ["wifi_quality", "power_outlets", "coffee_quality"] as const;
      keys.forEach(k => {
        const vals = data.map(d => d[k]).filter(Boolean) as number[];
        if (vals.length > 0) avg[k] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10;
      });

      const vibes = data.map(d => d.overall_vibe).filter(Boolean);
      const vibeCounts: Record<string, number> = {};
      vibes.forEach(v => { vibeCounts[v as string] = (vibeCounts[v as string] || 0) + 1; });
      const dominantVibe = Object.entries(vibeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      setSummary({ avg, count: data.length, dominantVibe });
    })();
  }, [venueName]);

  if (!summary) return null;

  const vibeLabels: Record<string, string> = { deep_focus: "Deep Focus", balanced: "Balanced", social: "Social" };

  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
      {summary.avg.wifi_quality && <span>📶 {summary.avg.wifi_quality}</span>}
      {summary.avg.power_outlets && <span>🔌 {summary.avg.power_outlets}</span>}
      {summary.avg.coffee_quality && <span>☕ {summary.avg.coffee_quality}</span>}
      {summary.dominantVibe && <span className="text-primary font-medium">Best for: {vibeLabels[summary.dominantVibe] || summary.dominantVibe}</span>}
      <span>({summary.count} ratings)</span>
    </div>
  );
}
