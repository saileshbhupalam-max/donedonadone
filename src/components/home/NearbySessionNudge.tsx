/**
 * @module NearbySessionNudge
 * @description Proactive nudge card for nearby upcoming sessions.
 * Shows sessions near the user — even if they don't perfectly match preferences —
 * with messaging like "We know you prefer X, but there's a session at Y".
 * Goal: increase successful sessions by encouraging flexible attendance.
 *
 * Key exports:
 * - NearbySessionNudge — Home card component
 *
 * Dependencies: supabase, useAuth, useNavigate
 * Tables: events (via find_nearby_sessions RPC)
 */
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Clock, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { displayNeighborhood } from "@/lib/neighborhoods";

interface NearbySession {
  event_id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  neighborhood: string | null;
  rsvp_count: number;
  distance_km: number;
}

interface NearbySessionNudgeProps {
  sessions: NearbySession[];
  userNeighborhood?: string | null;
  userPreferredTime?: string | null;
}

function getTimeSlot(startTime: string | null): string | null {
  if (!startTime) return null;
  const hour = parseInt(startTime.split(":")[0], 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function NearbySessionNudge({ sessions, userNeighborhood, userPreferredTime }: NearbySessionNudgeProps) {
  const navigate = useNavigate();

  if (!sessions || sessions.length === 0) return null;

  // Show top 2 nearest sessions
  const top = sessions.slice(0, 2);

  return (
    <div className="space-y-2">
      {top.map((s) => {
        const isNearby = s.distance_km <= 2;
        const sameNeighborhood = userNeighborhood && s.neighborhood === userNeighborhood;
        const sessionSlot = getTimeSlot(s.start_time);
        const matchesTimePreference = !userPreferredTime || sessionSlot === userPreferredTime;
        const isFlexNudge = !sameNeighborhood || !matchesTimePreference;

        return (
          <Card key={s.event_id} className="border-primary/20 bg-primary/5">
            <CardContent className="p-3">
              {isFlexNudge && (
                <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  {!sameNeighborhood
                    ? `Outside your usual area, but only ${s.distance_km.toFixed(1)} km away`
                    : `Different time than usual — but ${s.rsvp_count} people are already going`}
                </p>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    {s.venue_name && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{s.venue_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(s.date), "EEE, MMM d")}{s.start_time ? ` · ${s.start_time}` : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />{s.rsvp_count} going
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="default" className="shrink-0 text-xs h-8" onClick={() => navigate(`/events/${s.event_id}`)}>
                  Join
                </Button>
              </div>
              <div className="flex gap-1 mt-1.5">
                {isNearby && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Nearby</Badge>}
                {s.neighborhood && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{displayNeighborhood(s.neighborhood)}</Badge>}
                {s.rsvp_count >= 3 && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">Filling up</Badge>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
