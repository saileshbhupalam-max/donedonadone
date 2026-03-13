import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { startOfMonth, endOfMonth } from "date-fns";
import { ERROR_STATES, CONFIRMATIONS } from "@/lib/personality";
import { updateReliability, promoteWaitlist } from "@/lib/antifragile";
import { trackAnalyticsEvent } from "@/lib/growth";
import { saveToCache, getFromCache } from "@/lib/offlineCache";
import { captureSupabaseError } from "@/lib/sentry";

type Profile = Tables<"profiles">;

export interface Event {
  id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  neighborhood: string | null;
  whatsapp_group_link: string | null;
  max_spots: number | null;
  session_format: string | null;
  women_only: boolean | null;
  created_by: string | null;
  rsvp_count: number | null;
  created_at: string | null;
  creator?: Profile;
  rsvps?: EventRsvp[];
}

export interface EventRsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  created_at: string | null;
  profile?: Profile;
}

export interface ToggleRsvpOptions {
  /** Monthly session limit from subscription tier. -1 = unlimited, 0 = none. */
  monthlySessionLimit?: number;
}

export function useEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const isTogglingRef = useRef(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      captureSupabaseError("EventsLoad", error, { table: "events" });
      // Offline fallback: serve cached events when the network request fails
      const cached = await getFromCache<Event[]>("events");
      if (cached) {
        setEvents(cached);
      }
      setLoading(false);
      return;
    }

    if (!eventsData) {
      setLoading(false);
      return;
    }

    // Fetch RSVPs for all events
    const eventIds = eventsData.map((e) => e.id);
    const { data: rsvpsData } = await supabase
      .from("event_rsvps")
      .select("*")
      .in("event_id", eventIds);

    // Fetch profiles for creators and RSVPs
    const profileIds = new Set<string>();
    eventsData.forEach((e) => { if (e.created_by) profileIds.add(e.created_by); });
    rsvpsData?.forEach((r) => profileIds.add(r.user_id));

    const { data: profiles } = profileIds.size > 0
      ? await supabase.from("profiles").select("*").in("id", Array.from(profileIds))
      : { data: [] as Profile[] };

    const profileMap = new Map<string, Profile>();
    profiles?.forEach((p) => profileMap.set(p.id, p));

    const enriched: Event[] = eventsData.map((e) => ({
      ...e,
      creator: e.created_by ? profileMap.get(e.created_by) : undefined,
      rsvps: (rsvpsData || [])
        .filter((r) => r.event_id === e.id)
        .map((r) => ({ ...r, profile: profileMap.get(r.user_id) })),
    }));

    setEvents(enriched);
    // Persist to IndexedDB for offline fallback
    saveToCache("events", enriched).catch(() => {});
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const getUserRsvp = useCallback((eventId: string) => {
    if (!user) return null;
    const event = events.find((e) => e.id === eventId);
    return event?.rsvps?.find((r) => r.user_id === user.id) || null;
  }, [events, user]);

  const toggleRsvp = useCallback(async (eventId: string, status: "going" | "interested", options?: ToggleRsvpOptions) => {
    if (!user) return;

    // TD-014: Prevent concurrent calls (double-click guard)
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;

    try {
      const existing = getUserRsvp(eventId);

      // TD-004: Enforce monthly booking limit when creating a new "going" RSVP
      const isNewGoing = !existing && status === "going";
      const isUpgradeToGoing = existing && existing.status !== "going" && status === "going";
      if ((isNewGoing || isUpgradeToGoing) && options?.monthlySessionLimit !== undefined && options.monthlySessionLimit !== -1) {
        const now = new Date();
        const monthStart = startOfMonth(now).toISOString();
        const monthEnd = endOfMonth(now).toISOString();
        const { count, error: countError } = await supabase
          .from("event_rsvps")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "going")
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd);

        if (!countError && count !== null && count >= options.monthlySessionLimit) {
          toast.error("You've reached your monthly session limit. Upgrade for more sessions!");
          return;
        }
      }

      // Save snapshot for rollback
      const snapshot = events;

      // Optimistic update
      setEvents((prev) => prev.map((e) => {
        if (e.id !== eventId) return e;
        let newRsvps = [...(e.rsvps || [])];
        if (existing?.status === status) {
          newRsvps = newRsvps.filter((r) => r.user_id !== user.id);
        } else if (existing) {
          newRsvps = newRsvps.map((r) => r.user_id === user.id ? { ...r, status } : r);
        } else {
          newRsvps.push({ id: crypto.randomUUID(), event_id: eventId, user_id: user.id, status, created_at: new Date().toISOString() });
        }
        const goingCount = newRsvps.filter((r) => r.status === "going").length;
        return { ...e, rsvps: newRsvps, rsvp_count: goingCount };
      }));

      try {
        if (existing?.status === status) {
          // Toggle off = cancellation
          const { error } = await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", user.id);
          if (error) throw error;
          await supabase.from("events").update({ rsvp_count: Math.max(0, (events.find(e => e.id === eventId)?.rsvp_count || 1) - (existing.status === "going" ? 1 : 0)) }).eq("id", eventId);
          if (existing.status === "going") {
            promoteWaitlist(eventId).catch(() => {});
          }
          trackAnalyticsEvent('rsvp_cancel', user.id, { event_id: eventId }).catch(() => {});
        } else if (existing) {
          const { error } = await supabase.from("event_rsvps").update({ status }).eq("event_id", eventId).eq("user_id", user.id);
          if (error) throw error;
          const event = events.find(e => e.id === eventId);
          const delta = (status === "going" ? 1 : 0) - (existing.status === "going" ? 1 : 0);
          if (delta !== 0) {
            await supabase.from("events").update({ rsvp_count: Math.max(0, (event?.rsvp_count || 0) + delta) }).eq("id", eventId);
          }
          if (status === "going") {
            updateReliability(user.id, 'rsvp').catch(() => {});
            trackAnalyticsEvent('rsvp', user.id, { event_id: eventId }).catch(() => {});
          }
          if (existing.status === "going" && status !== "going") {
            promoteWaitlist(eventId).catch(() => {});
            trackAnalyticsEvent('rsvp_cancel', user.id, { event_id: eventId }).catch(() => {});
          }
        } else {
          const { error } = await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: user.id, status });
          if (error) throw error;
          if (status === "going") {
            const event = events.find(e => e.id === eventId);
            await supabase.from("events").update({ rsvp_count: (event?.rsvp_count || 0) + 1 }).eq("id", eventId);
            updateReliability(user.id, 'rsvp').catch(() => {});
            trackAnalyticsEvent('rsvp', user.id, { event_id: eventId }).catch(() => {});
          }
        }
      } catch (error) {
        captureSupabaseError("ToggleRsvp", error, { eventId, status });
        toast.error(ERROR_STATES.generic);
        setEvents(snapshot); // Revert
      }
    } finally {
      isTogglingRef.current = false;
    }
  }, [user, events, getUserRsvp]);

  const createEvent = useCallback(async (eventData: {
    title: string;
    description?: string;
    date: string;
    start_time?: string;
    end_time?: string;
    venue_name?: string;
    venue_address?: string;
    neighborhood?: string;
    whatsapp_group_link?: string;
    max_spots?: number | null;
    women_only?: boolean;
  }) => {
    if (!user) return;
    const { data, error } = await supabase.from("events").insert({
      ...eventData,
      created_by: user.id,
    }).select().single();

    if (error) {
      captureSupabaseError("CreateEvent", error, { table: "events" });
      toast.error(ERROR_STATES.generic);
    }

    if (data && !error) {
      setEvents((prev) => [...prev, { ...data, creator: undefined, rsvps: [] }]);
    }
    return { data, error };
  }, [user]);

  const today = new Date().toISOString().split("T")[0];
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));

  return { events, upcoming, past, loading, fetchEvents, toggleRsvp, getUserRsvp, createEvent };
}
