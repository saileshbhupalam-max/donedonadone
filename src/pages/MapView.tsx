import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { SessionMap } from "@/components/map/SessionMap";
import { usePageTitle } from "@/hooks/usePageTitle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation, haversineDistance } from "@/hooks/useGeolocation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Map, List, MapPin, CalendarIcon, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface NearbySession {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  venue_name: string | null;
  going: number;
  max_spots: number | null;
  distance_m: number | null;
  lat: number;
  lng: number;
}

export default function MapView() {
  usePageTitle("Map — donedonadone");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const focusEventId = searchParams.get("event");
  const [view, setView] = useState<"map" | "list">("map");
  const [sessions, setSessions] = useState<NearbySession[]>([]);
  const { position } = useGeolocation();

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const [eventsRes, rsvpsRes] = await Promise.all([
        supabase.from("events").select("id, title, date, start_time, venue_name, max_spots, venue_latitude, venue_longitude").gte("date", today).not("venue_latitude", "is", null),
        supabase.from("event_rsvps").select("event_id, status"),
      ]);
      const counts: Record<string, number> = {};
      (rsvpsRes.data || []).forEach((r: any) => {
        if (r.status === "going") counts[r.event_id] = (counts[r.event_id] || 0) + 1;
      });
      setSessions((eventsRes.data || []).filter((e: any) => e.venue_latitude).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        start_time: e.start_time,
        venue_name: e.venue_name,
        max_spots: e.max_spots,
        going: counts[e.id] || 0,
        lat: e.venue_latitude,
        lng: e.venue_longitude,
        distance_m: position ? haversineDistance(position.latitude, position.longitude, e.venue_latitude, e.venue_longitude) : null,
      })));
    })();
  }, [position]);

  const sorted = useMemo(() =>
    [...sessions].sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity)),
    [sessions]
  );

  return (
    <AppShell>
      <div className="h-[calc(100vh-4rem)] flex flex-col relative">
        {/* Toggle */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000]">
          <div className="bg-background border border-border rounded-full shadow-lg flex p-1">
            <button
              onClick={() => setView("map")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${view === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Map className="w-3.5 h-3.5 inline mr-1" />Map
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              <List className="w-3.5 h-3.5 inline mr-1" />List
            </button>
          </div>
        </div>

        {view === "map" ? (
          <div className="flex-1">
            <SessionMap focusEventId={focusEventId} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
            <h2 className="font-serif text-lg text-foreground">Sessions near you</h2>
            {sorted.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <MapPin className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">No sessions found nearby.</p>
                <p className="text-xs text-muted-foreground">Try expanding your radius or check back later.</p>
              </div>
            ) : sorted.map(s => (
              <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/events/${s.id}`)}>
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-sm text-foreground">{s.title}</h3>
                    {s.distance_m != null && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {s.distance_m < 1000 ? `${Math.round(s.distance_m)}m` : `${(s.distance_m / 1000).toFixed(1)}km`}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarIcon className="w-3 h-3" />
                    <span>{format(parseISO(s.date), "EEE, MMM d")}{s.start_time ? ` · ${s.start_time}` : ""}</span>
                  </div>
                  {s.venue_name && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{s.venue_name}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{s.going}{s.max_spots ? ` / ${s.max_spots}` : ""} going</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
