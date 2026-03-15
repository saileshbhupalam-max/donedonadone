// Auto-Sessions Edge Function
//
// Two jobs:
// 1. DEMAND CLUSTERING — group pending session_requests into sessions (original)
// 2. PROXIMITY CLUBBING — find checked-in users near each other, suggest spontaneous
//    sessions, notify 2-3x the needed headcount (overbooking) with "limited spots,
//    first come first served" urgency to ensure minimum attendance.
//
// Runs via pg_cron: before each session window (7:30 AM, 12:30 PM, 7:30 PM IST)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MIN_CLUSTER_SIZE = 3;
const MAX_SESSION_SIZE = 8;
// Base multiplier — adjusted by getAdaptiveMultiplier() for proximity clubbing
const BASE_OVERBOOK_MULTIPLIER = 2.5;

const TIME_SLOT_MAP: Record<string, { start: string; end: string; format: string; label: string }> = {
  morning:   { start: "09:30", end: "13:30", format: "focus_only_4hr",  label: "Morning Focus" },
  afternoon: { start: "14:00", end: "18:00", format: "structured_4hr", label: "Afternoon Hustle" },
  evening:   { start: "18:00", end: "21:00", format: "structured_2hr", label: "Evening Session" },
};

// Determine current session window based on IST hour
function getCurrentWindow(): string | null {
  const istHour = (new Date().getUTCHours() + 5) % 24 + (new Date().getUTCMinutes() + 30 >= 60 ? 1 : 0);
  if (istHour >= 6 && istHour < 11) return "morning";
  if (istHour >= 11 && istHour < 16) return "afternoon";
  if (istHour >= 16 && istHour < 21) return "evening";
  return null;
}

// Adaptive overbook multiplier — learns from historical response data.
// Computes response rate from past nudge logs, narrowing by the most specific
// matching dimensions available: venue + window + day of week.
// Falls back to broader slices when not enough data at a narrow level.
async function getAdaptiveMultiplier(
  supabase: ReturnType<typeof createClient>,
  locationId: string,
  window: string,
): Promise<number> {
  const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const dayType = isWeekend ? "weekend" : "weekday";

  // Try progressively broader slices until we have enough data (>=3 logs)
  // 1. Exact match: same venue + same window + same day type
  // 2. Same venue + same window (any day)
  // 3. Same venue (any window, any day)
  // 4. Same window + same day type (any venue — system-wide learning)
  // 5. Default
  const slices: Array<{ location?: string; window?: string; dayType?: string }> = [
    { location: locationId, window, dayType },
    { location: locationId, window },
    { location: locationId },
    { window, dayType },
  ];

  for (const slice of slices) {
    const rate = await computeResponseRate(supabase, slice.location, slice.window, slice.dayType);
    if (rate !== null) {
      // Add 20% safety buffer — better to over-notify than have empty seats
      const computed = (rate > 0 ? 1 / rate : 4.5) * 1.2;
      return Math.max(2.0, Math.min(5.0, computed));
    }
  }

  // No data: start high, let it come down as we learn
  return 3.0;
}

// Compute response rate for a given slice of past proximity nudge logs.
// Returns null if not enough data (<3 logs with notifications).
async function computeResponseRate(
  supabase: ReturnType<typeof createClient>,
  locationId?: string,
  window?: string,
  dayType?: string, // "weekday" or "weekend"
): Promise<number | null> {
  let query = supabase
    .from("notification_log")
    .select("metadata, created_at")
    .eq("category", "proximity_session")
    .order("created_at", { ascending: false })
    .limit(20);

  if (locationId) query = query.eq("metadata->>location_id", locationId);
  if (window) query = query.eq("metadata->>window", window);

  const { data: logs } = await query;
  if (!logs || logs.length === 0) return null;

  // Filter by day type if requested
  let filtered = logs;
  if (dayType) {
    filtered = logs.filter((log) => {
      const date = new Date(log.created_at || "");
      const dow = date.getDay();
      const isWe = dow === 0 || dow === 6;
      return dayType === "weekend" ? isWe : !isWe;
    });
  }

  // Need at least 3 data points to be meaningful
  let totalNotified = 0;
  let totalResponded = 0;
  let usable = 0;

  for (const log of filtered) {
    const meta = log.metadata as any;
    const extraNotified = Number(meta?.extra_notified) || 0;
    const clusterSize = Number(meta?.cluster_size) || 0;
    const locId = meta?.location_id;
    if (extraNotified === 0 || !locId) continue;

    const nudgeDate = (log.created_at || "").split("T")[0];
    if (!nudgeDate) continue;

    const { count } = await supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locId)
      .gte("checked_in_at", nudgeDate + "T00:00:00")
      .lt("checked_in_at", nudgeDate + "T23:59:59");

    const responded = Math.max(0, (count || 0) - clusterSize);
    totalNotified += extraNotified;
    totalResponded += responded;
    usable++;
  }

  if (usable < 3) return null;
  if (totalNotified === 0) return null;

  return totalResponded / totalNotified;
}

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results = { demand_sessions: 0, proximity_nudges: 0, people_notified: 0 };

  // ═══════════════════════════════════════════════════════
  // PART 1: DEMAND CLUSTERING (from session_requests)
  // ═══════════════════════════════════════════════════════

  const { data: requests } = await supabase
    .from("session_requests")
    .select("id, user_id, neighborhood, preferred_time, venue_preference")
    .eq("status", "pending")
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());

  if (requests && requests.length > 0) {
    const groups: Record<string, typeof requests> = {};
    for (const r of requests) {
      const key = `${r.neighborhood}__${r.preferred_time}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }

    for (const [clusterKey, reqs] of Object.entries(groups)) {
      if (reqs.length < MIN_CLUSTER_SIZE) continue;

      // Skip if already created
      const { data: existing } = await supabase
        .from("events").select("id").eq("demand_cluster_key", clusterKey).eq("auto_created", true).limit(1);
      if (existing && existing.length > 0) continue;

      const neighborhood = reqs[0].neighborhood;
      const preferredTime = reqs[0].preferred_time;
      const timeSlot = TIME_SLOT_MAP[preferredTime] || TIME_SLOT_MAP.morning;

      // Find next non-weekend day
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
      while (targetDate.getDay() === 0 || targetDate.getDay() === 6) targetDate.setDate(targetDate.getDate() + 1);
      const dateStr = targetDate.toISOString().split("T")[0];

      // Check venue capacity via venue_slots before picking a venue
      // Maps preferred_time to the time_slot parameter the RPC expects
      const { data: availableSlots } = await supabase.rpc("find_available_venue_slots", {
        p_neighborhood: neighborhood,
        p_date: dateStr,
        p_time_slot: preferredTime || "morning",
      });

      let venueId: string;
      let venueName: string;
      let maxSeats: number;

      let needsVenueApproval = false;

      if (availableSlots && availableSlots.length > 0) {
        // Use the venue with the most available seats
        const best = availableSlots[0]; // Already sorted by available_seats DESC
        venueId = best.location_id;
        venueName = best.location_name;
        maxSeats = Math.min(Number(best.available_seats), MAX_SESSION_SIZE);

        // Check if venue requires approval for this group size
        const groupSize = Math.min(reqs.length + 2, maxSeats);
        if (!best.auto_approve || (best.auto_approve_max && groupSize > best.auto_approve_max)) {
          needsVenueApproval = true;
        }
      } else {
        // Fallback: pick any venue in the neighborhood (no slots configured = open availability)
        const { data: locations } = await supabase
          .from("locations").select("id, name").eq("neighborhood", neighborhood).limit(1);
        if (!locations || locations.length === 0) continue;
        venueId = locations[0].id;
        venueName = locations[0].name;
        maxSeats = MAX_SESSION_SIZE;
      }

      const userIds = reqs.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles").select("id, is_table_captain, events_attended")
        .in("id", userIds).order("events_attended", { ascending: false });
      const captainId = profiles?.find((p) => p.is_table_captain)?.id || profiles?.[0]?.id || userIds[0];

      const eventStatus = needsVenueApproval ? "pending_venue_approval" : "upcoming";

      const { data: event } = await supabase
        .from("events").insert({
          title: `${timeSlot.label} at ${venueName}`,
          date: dateStr,
          start_time: timeSlot.start, end_time: timeSlot.end,
          session_format: timeSlot.format,
          location_id: venueId, neighborhood,
          max_attendees: Math.min(reqs.length + 2, maxSeats),
          auto_created: true, demand_cluster_key: clusterKey,
          created_by: captainId, status: eventStatus,
        }).select("id").single();

      if (!event) continue;

      await supabase.from("session_requests").update({ status: "fulfilled" }).in("id", reqs.map((r) => r.id));
      await supabase.from("event_rsvps").upsert(
        userIds.map((uid) => ({ event_id: event.id, user_id: uid, status: "going" })),
        { onConflict: "event_id,user_id" }
      );

      if (needsVenueApproval) {
        // Notify venue partner that approval is needed
        const { data: loc } = await supabase
          .from("locations").select("partner_user_id").eq("id", venueId).single();
        if (loc?.partner_user_id) {
          await supabase.from("notifications").insert({
            user_id: loc.partner_user_id, type: "venue_approval_needed",
            title: "Session needs your approval",
            body: `${reqs.length} people want a ${timeSlot.label} at your venue on ${dateStr}. Approve or decline from your dashboard.`,
            data: { event_id: event.id }, read: false,
          });
        }
        // Notify attendees that it's pending
        await supabase.from("notifications").insert(
          userIds.map((uid) => ({
            user_id: uid, type: "session_auto_created",
            title: `${timeSlot.label} requested!`,
            body: `${reqs.length} people want to cowork at ${venueName}. Waiting for venue confirmation.`,
            data: { event_id: event.id }, read: false,
          }))
        );
      } else {
        await supabase.from("notifications").insert(
          userIds.map((uid) => ({
            user_id: uid, type: "session_auto_created",
            title: `${timeSlot.label} created!`,
            body: `${reqs.length} people want to cowork — session at ${venueName}. You're in!`,
            data: { event_id: event.id }, read: false,
          }))
        );
      }
      results.demand_sessions++;
    }
  }

  // ═══════════════════════════════════════════════════════
  // PART 2: PROXIMITY CLUBBING (from active check-ins)
  // ═══════════════════════════════════════════════════════

  const currentWindow = getCurrentWindow();
  if (!currentWindow) {
    return new Response(JSON.stringify({ ...results, message: "Outside session windows" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Find clusters of checked-in users at the same venue
  const { data: clusters } = await supabase.rpc("find_proximity_clusters", {
    p_min_cluster_size: MIN_CLUSTER_SIZE,
    p_radius_meters: 1000,
  });

  if (clusters && clusters.length > 0) {
    for (const cluster of clusters) {
      const { location_id, location_name, neighborhood, user_ids, cluster_size } = cluster;

      // Skip if we already nudged this cluster today
      const today = new Date().toISOString().split("T")[0];
      const nudgeKey = `proximity__${location_id}__${today}`;
      const { data: existingNudge } = await supabase
        .from("notification_log").select("id")
        .eq("category", "proximity_session")
        .eq("metadata->>nudge_key", nudgeKey).limit(1);
      if (existingNudge && existingNudge.length > 0) continue;

      // OVERBOOK: find additional nearby users to notify
      // Adaptive multiplier adjusts based on time, day, and historical response
      const overbookMultiplier = await getAdaptiveMultiplier(supabase, location_id, currentWindow);
      const spotsToFill = Math.min(MAX_SESSION_SIZE, cluster_size + 3);
      const extraNotifyCount = Math.ceil(spotsToFill * overbookMultiplier) - cluster_size;

      let extraUserIds: string[] = [];
      if (extraNotifyCount > 0 && neighborhood) {
        const { data: nearbyProfiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("neighborhood", neighborhood)
          .not("id", "in", `(${user_ids.join(",")})`)
          .limit(extraNotifyCount);
        extraUserIds = (nearbyProfiles || []).map((p: { id: string }) => p.id);
      }

      const timeSlot = TIME_SLOT_MAP[currentWindow];

      // Notify the checked-in cluster: "People are here! Start a session?"
      const clusterNotifications = user_ids.map((uid: string) => ({
        user_id: uid, type: "proximity_session",
        title: `${cluster_size} people coworking near you`,
        body: `Start a ${timeSlot.label} at ${location_name}? You're already here!`,
        data: { location_id, neighborhood, window: currentWindow },
        read: false,
      }));

      // Notify nearby users with overbooking urgency
      const overbookNotifications = extraUserIds.map((uid) => ({
        user_id: uid, type: "proximity_session",
        title: `${cluster_size} people at ${location_name} right now`,
        body: `Limited spots for a spontaneous ${timeSlot.label}. First come, first served — join now?`,
        data: { location_id, neighborhood, window: currentWindow },
        read: false,
      }));

      const allNotifications = [...clusterNotifications, ...overbookNotifications];
      if (allNotifications.length > 0) {
        await supabase.from("notifications").insert(allNotifications);

        // Also send push notifications for urgency
        for (const notif of allNotifications) {
          // Fire-and-forget push via send-notification function
          await supabase.functions.invoke("send-notification", {
            body: {
              user_id: notif.user_id,
              category: "proximity_session",
              title: notif.title,
              body: notif.body,
              link: `/events?neighborhood=${neighborhood}`,
              data: notif.data,
            },
          }).catch(() => {/* push is best-effort */});
        }

        // Log to prevent re-nudging today
        await supabase.from("notification_log").insert({
          user_id: user_ids[0],
          channel: "push",
          category: "proximity_session",
          title: `Proximity cluster at ${location_name}`,
          body: `${cluster_size} checked in, ${extraUserIds.length} extra notified`,
          status: "sent",
          metadata: {
            nudge_key: nudgeKey,
            cluster_size, extra_notified: extraUserIds.length,
            overbook_multiplier: overbookMultiplier,
            window: currentWindow,
            location_id, neighborhood,
          },
        });

        results.proximity_nudges++;
        results.people_notified += allNotifications.length;
      }
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});
