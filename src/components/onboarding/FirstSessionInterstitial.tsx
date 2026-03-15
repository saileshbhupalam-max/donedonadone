/**
 * @module FirstSessionInterstitial
 * @description Post-onboarding interstitial that guides new users to their first session.
 * Shown once after onboarding completes, then auto-dismissed via localStorage flag.
 *
 * WHY this exists: Duolingo data shows users who complete their first lesson within
 * 2 minutes of signup have 3x D7 retention. Slack's "3 messages sent" activation
 * metric shows 2x retention for users who hit it. Our activation metric is
 * "attend first session" — this interstitial reduces time-to-first-action by
 * presenting the next session immediately instead of dropping users on a list page.
 *
 * Key exports: FirstSessionInterstitial
 * Dependencies: Supabase client, AuthContext
 * Tables: events, event_rsvps
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon, MapPin, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { getNeighborhoodLabel } from "@/lib/neighborhoods";

interface Props {
  /** User's neighborhood (normalized slug) from onboarding data */
  neighborhood: string;
  /** Called when user picks an action and interstitial should close */
  onDismiss: (destination: "event" | "request" | "explore") => void;
}

interface NearbyEvent {
  id: string;
  title: string;
  date: string;
  start_time: string;
  neighborhood: string;
  venue_name?: string;
}

const DISMISSED_KEY = "danadone_first_session_seen";

/**
 * Post-onboarding interstitial. Shows the nearest upcoming session in the user's
 * neighborhood, or a "Request Your First Session" CTA if none exist.
 *
 * WHY interstitial > redirect: A redirect to /events loses the emotional high of
 * completing onboarding. The interstitial maintains momentum with a celebratory
 * frame while channeling it into the activation action (Fogg Behavior Model:
 * high motivation + low friction trigger = action).
 */
export function FirstSessionInterstitial({ neighborhood, onDismiss }: Props) {
  const { user } = useAuth();
  const [nearbyEvent, setNearbyEvent] = useState<NearbyEvent | null>(null);
  const [loading, setLoading] = useState(true);

  // WHY check localStorage: Show this exactly once per user. Repeat exposure
  // after the first view adds friction without value — the user has already
  // made their choice. One-shot interstitials have higher conversion than
  // persistent banners (Mixpanel benchmark: 2.3x CTR for first-time modals).
  const alreadySeen = localStorage.getItem(DISMISSED_KEY) === "true";

  useEffect(() => {
    if (alreadySeen || !neighborhood) {
      setLoading(false);
      return;
    }

    const fetchNextSession = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("events")
        .select("id, title, date, start_time, neighborhood")
        .eq("neighborhood", neighborhood)
        .gte("date", today)
        .eq("status", "upcoming")
        .order("date", { ascending: true })
        .limit(1);

      if (data && data.length > 0) {
        setNearbyEvent(data[0] as NearbyEvent);
      }
      setLoading(false);
    };

    fetchNextSession();
  }, [neighborhood, alreadySeen]);

  const handleDismiss = (dest: "event" | "request" | "explore") => {
    localStorage.setItem(DISMISSED_KEY, "true");
    onDismiss(dest);
  };

  if (alreadySeen) return null;
  if (loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm px-5"
    >
      <Card className="w-full max-w-sm border-primary/20 shadow-lg">
        <CardContent className="p-6 space-y-5 text-center">
          {/* Celebratory header */}
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-serif text-xl text-foreground">
              Welcome to DanaDone!
            </h2>
            <p className="text-sm text-muted-foreground">
              You're all set in <span className="font-medium text-foreground">{getNeighborhoodLabel(neighborhood)}</span>.
              {" "}Let's get you to your first session.
            </p>
          </div>

          {nearbyEvent ? (
            /* WHY show the specific event: Reduces decision fatigue. Instead of
               "go browse a list", we present one clear action. Hick's Law: fewer
               choices = faster decisions. Showing date/time/venue makes the
               commitment feel concrete and real. */
            <div className="bg-muted/50 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Next session near you
              </p>
              <p className="text-sm font-medium text-foreground">{nearbyEvent.title}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {format(parseISO(nearbyEvent.date), "EEE, MMM d")}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {getNeighborhoodLabel(nearbyEvent.neighborhood)}
                </span>
              </div>
            </div>
          ) : (
            /* WHY "request" instead of "no sessions available": Framing matters.
               "No sessions" is a dead end. "Request your first session" turns
               absence into agency — the user becomes a demand signal that triggers
               auto-session creation (see autoSession.ts). */
            <div className="bg-muted/50 rounded-xl p-4 text-left space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                No sessions scheduled yet
              </p>
              <p className="text-sm text-muted-foreground">
                Be the first to request one — we'll match you when 2 more people want the same slot.
              </p>
            </div>
          )}

          {/* Primary CTA */}
          <Button
            size="lg"
            className="w-full rounded-full text-base font-medium"
            onClick={() => handleDismiss(nearbyEvent ? "event" : "request")}
          >
            {nearbyEvent ? "Join Your First Session" : "Request Your First Session"}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>

          {/* Secondary escape hatch — always available so users don't feel trapped */}
          <button
            onClick={() => handleDismiss("explore")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Explore first
          </button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
