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
// Notify this many times more people than needed — not everyone responds
const OVERBOOK_MULTIPLIER = 2.5;

const TIME_SLOT_MAP: Record<string, { start: string; end: string; format: string; label: string }> = {
  morning:   { start: "09:30", end: "13:30", format: "focus_only_4hr", label: "Morning Focus" },
  afternoon: { start: "14:00", end: "18:00", format: "networking_4hr", label: "Afternoon Hustle" },
  evening:   { start: "18:00", end: "21:00", format: "evening_2hr",   label: "Evening Session" },
};

// Determine current session window based on IST hour
function getCurrentWindow(): string | null {
  const istHour = (new Date().getUTCHours() + 5) % 24 + (new Date().getUTCMinutes() + 30 >= 60 ? 1 : 0);
  if (istHour >= 6 && istHour < 11) return "morning";
  if (istHour >= 11 && istHour < 16) return "afternoon";
  if (istHour >= 16 && istHour < 21) return "evening";
  return null;
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
    .eq("status", "pending");

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

      const { data: locations } = await supabase
        .from("locations").select("id, name").eq("neighborhood", neighborhood).limit(1);
      if (!locations || locations.length === 0) continue;
      const venue = locations[0];

      const userIds = reqs.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles").select("id, is_table_captain, events_attended")
        .in("id", userIds).order("events_attended", { ascending: false });
      const captainId = profiles?.find((p) => p.is_table_captain)?.id || profiles?.[0]?.id || userIds[0];

      const timeSlot = TIME_SLOT_MAP[preferredTime] || TIME_SLOT_MAP.morning;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: event } = await supabase
        .from("events").insert({
          title: `${timeSlot.label} at ${venue.name}`,
          date: tomorrow.toISOString().split("T")[0],
          start_time: timeSlot.start, end_time: timeSlot.end,
          session_format: timeSlot.format,
          location_id: venue.id, neighborhood,
          max_attendees: Math.min(reqs.length + 2, MAX_SESSION_SIZE),
          auto_created: true, demand_cluster_key: clusterKey,
          created_by: captainId, status: "upcoming",
        }).select("id").single();

      if (!event) continue;

      await supabase.from("session_requests").update({ status: "fulfilled" }).in("id", reqs.map((r) => r.id));
      await supabase.from("rsvps").upsert(
        userIds.map((uid) => ({ event_id: event.id, user_id: uid, status: "going" })),
        { onConflict: "event_id,user_id" }
      );
      await supabase.from("notifications").insert(
        userIds.map((uid) => ({
          user_id: uid, type: "session_auto_created",
          title: `${timeSlot.label} created!`,
          body: `${reqs.length} people want to cowork — session at ${venue.name}. You're in!`,
          data: { event_id: event.id }, read: false,
        }))
      );
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
      // Get users in the same neighborhood who aren't already checked in at this venue
      const spotsToFill = Math.min(MAX_SESSION_SIZE, cluster_size + 3);
      const extraNotifyCount = Math.ceil(spotsToFill * OVERBOOK_MULTIPLIER) - cluster_size;

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
            overbook_multiplier: OVERBOOK_MULTIPLIER,
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
