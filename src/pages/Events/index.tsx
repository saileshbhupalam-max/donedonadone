import { ERROR_STATES, CONFIRMATIONS } from "@/lib/personality";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { hapticLight } from "@/lib/haptics";
import { useState, useEffect, useCallback, useRef, lazy, Suspense, useMemo } from "react";
import { getInitials } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { useEvents, Event as EventType } from "@/hooks/useEvents";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonalityLoader } from "@/components/ui/PersonalityLoader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, Plus, MapPin, Hand, AlertTriangle, Send, Map, List, Bookmark } from "lucide-react";
import { format, parseISO, isTomorrow, differenceInDays, differenceInHours } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/usePageTitle";
import { trackFunnelStep } from "@/lib/analytics";
import { calculateSessionHours, addFocusHours } from "@/lib/ranks";
import { createSessionPhases, getFormatPhases, getFormatLabel } from "@/lib/sessionPhases";
import { GivePropsFlow } from "@/components/session/GivePropsFlow";
import { VenueReviewCard } from "@/components/venue/VenueReviewCard";
import { VenueVibeSummary } from "@/components/session/VenueVibeRating";
import { motion } from "framer-motion";
import { getNeighborhoodLabel, SESSION_FORMATS } from "./constants";
import { EventCard } from "./EventCard";
import { useVenueBadgesBatch } from "@/hooks/useVenueBadgesBatch";
import { CreateEventButton } from "./CreateEventButton";
import { FeedbackCard } from "./FeedbackCard";
import { SessionRequestSheet } from "./SessionRequestSheet";

const SessionMap = lazy(() => import("@/components/map/SessionMap").then(m => ({ default: m.SessionMap })));

export default function Events() {
  usePageTitle("Sessions — DanaDone");
  useEffect(() => { trackFunnelStep("session", 1, "view_events"); }, []);
  const { profile, user } = useAuth();
  const { upcoming, past, loading, toggleRsvp, getUserRsvp, fetchEvents } = useEvents();
  const [filter, setFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all_formats");
  const neighborhoodDefaultApplied = useRef(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [savedEvents, setSavedEvents] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("fc_saved_events") || "[]"); }
    catch { return []; }
  });
  const [minThreshold, setMinThreshold] = useState(3);
  const [pendingFeedback, setPendingFeedback] = useState<any[]>([]);
  const [circleUserIds, setCircleUserIds] = useState<string[]>([]);

  // Batch-fetch venue badges for all visible events in a single query (TD-012)
  const allVenueNames = useMemo(
    () => [...upcoming, ...past].map((e) => e.venue_name).filter(Boolean) as string[],
    [upcoming, past]
  );
  const { badgeMap: venueBadgeMap } = useVenueBadgesBatch(allVenueNames);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "min_session_threshold").single()
      .then(({ data }) => { if (data?.value) setMinThreshold((data.value as Record<string, unknown>)?.value as number || 3); });
  }, []);

  // Fetch circle members for social proof
  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_my_circle", { p_user_id: user.id })
      .then(({ data }) => {
        if (data) setCircleUserIds(data.map((c: any) => c.circle_user_id));
      });
  }, [user]);

  // Default neighborhood filter from profile on first load
  useEffect(() => {
    if (neighborhoodDefaultApplied.current) return;
    if (profile?.neighborhood) {
      setFilter(profile.neighborhood);
      neighborhoodDefaultApplied.current = true;
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: rsvps } = await supabase.from("event_rsvps")
        .select("event_id, events:event_id(id, title, date)")
        .eq("user_id", user.id).eq("status", "going");
      if (!rsvps) return;
      const pastRsvps = rsvps.filter((r: any) => r.events && r.events.date < today);
      if (pastRsvps.length === 0) return;
      const eventIds = pastRsvps.map((r: any) => r.events.id);
      const { data: feedback } = await supabase.from("event_feedback")
        .select("event_id").eq("user_id", user.id).in("event_id", eventIds);
      const feedbackIds = new Set((feedback || []).map((f) => f.event_id));
      const pending = pastRsvps.filter((r: any) => !feedbackIds.has(r.events.id)).map((r: any) => r.events);
      setPendingFeedback(pending.slice(0, 2));
    })();
  }, [user]);

  const allNeighborhoods = [...new Set([...upcoming, ...past].map((e) => e.neighborhood).filter(Boolean))] as string[];

  const filterEvents = (list: EventType[]) => {
    let result = list;
    if (filter === "women_only") result = result.filter((e) => e.women_only);
    else if (filter !== "all") result = result.filter((e) => e.neighborhood === filter);
    if (formatFilter !== "all_formats") result = result.filter((e) => e.session_format === formatFilter);
    return result;
  };

  return (
    <AppShell>
      <PullToRefresh onRefresh={async () => { await fetchEvents(); }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        <h1 className="font-serif text-2xl text-foreground">Sessions</h1>

        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          <button onClick={() => setViewMode("list")}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1",
              viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button onClick={() => setViewMode("map")}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1",
              viewMode === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <MapPin className="w-3.5 h-3.5" /> Map
          </button>
        </div>

        {profile?.reliability_status === 'warning' && (
          <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200 text-sm">
              Heads up — you've missed recent sessions. One more no-show and your account will be restricted.
            </AlertDescription>
          </Alert>
        )}
        {profile?.reliability_status === 'restricted' && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive text-sm">
              Your account is restricted due to repeated no-shows. Contact us to restore access.
            </AlertDescription>
          </Alert>
        )}

        {user && pendingFeedback.map((ev) => (
          <FeedbackCard key={ev.id} event={ev} userId={user.id} onDismiss={() => setPendingFeedback((p) => p.filter((e) => e.id !== ev.id))} />
        ))}

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All Sessions</Button>
          {allNeighborhoods.map((n) => (
            <Button key={n} size="sm" variant={filter === n ? "default" : "outline"} onClick={() => setFilter(n)}>{getNeighborhoodLabel(n)}</Button>
          ))}
          {profile?.gender === "woman" && (
            <Button size="sm" variant={filter === "women_only" ? "secondary" : "outline"} onClick={() => setFilter("women_only")}>👩 Women Only</Button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {SESSION_FORMATS.map((f) => (
            <Button key={f.value} size="sm" variant={formatFilter === f.value ? "default" : "outline"} onClick={() => setFormatFilter(f.value)}>{f.label}</Button>
          ))}
        </div>

        {viewMode === "map" ? (
          <Suspense fallback={<Skeleton className="h-[400px] rounded-lg" />}>
            <div className="h-[400px] rounded-lg overflow-hidden"><SessionMap /></div>
          </Suspense>
        ) : (
          <Tabs defaultValue="upcoming">
            <TabsList className="w-full">
              <TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
              <TabsTrigger value="past" className="flex-1">Past</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="space-y-3 mt-3">
              {loading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />) :
                filterEvents(upcoming).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">No sessions near you yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Request one below — we'll match you when others want the same slot</p>
                  </div>
                ) : filterEvents(upcoming).map((e) => (
                  <EventCard key={e.id} event={e} onRsvp={toggleRsvp} userRsvp={getUserRsvp(e.id)}
                    isPast={false} allUpcoming={upcoming} minThreshold={minThreshold}
                    isRestricted={profile?.reliability_status === 'restricted'}
                    circleUserIds={circleUserIds}
                    preloadedBadges={e.venue_name ? venueBadgeMap.get(e.venue_name) : undefined} />
                ))}
              <SessionRequestSheet />
            </TabsContent>
            <TabsContent value="past" className="space-y-3 mt-3">
              {loading ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />) :
                filterEvents(past).length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">You haven't been to a session yet</p>
                ) : filterEvents(past).map((e) => (
                  <EventCard key={e.id} event={e} onRsvp={toggleRsvp} userRsvp={getUserRsvp(e.id)}
                    isPast={true} allUpcoming={upcoming} minThreshold={minThreshold}
                    circleUserIds={circleUserIds}
                    preloadedBadges={e.venue_name ? venueBadgeMap.get(e.venue_name) : undefined} />
                ))}
            </TabsContent>
          </Tabs>
        )}
      </motion.div>
      </PullToRefresh>
      <CreateEventButton onCreated={fetchEvents} />
    </AppShell>
  );
}
