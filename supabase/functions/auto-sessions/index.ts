// Auto-Sessions Edge Function
//
// Runs on a cron schedule (every 6 hours) to check for demand clusters
// and auto-create sessions. This is the FALLBACK sweep — the primary
// trigger is event-based via onNewSessionRequest() in the client.
//
// Deploy: supabase functions deploy auto-sessions
// Cron setup (pg_cron):
//   SELECT cron.schedule('auto-sessions', '0 0,6,12,18 * * *',
//     $$SELECT net.http_post(
//       'https://<project>.supabase.co/functions/v1/auto-sessions',
//       '{}', 'application/json',
//       ARRAY[net.http_header('Authorization', 'Bearer <service_role_key>')]
//     )$$
//   );
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MIN_CLUSTER_SIZE = 3;

const TIME_SLOT_MAP: Record<string, { start: string; format: string }> = {
  morning: { start: "09:00", format: "morning_2hr" },
  afternoon: { start: "14:00", format: "afternoon_2hr" },
  evening: { start: "18:00", format: "evening_2hr" },
};

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Get pending requests
  const { data: requests } = await supabase
    .from("session_requests")
    .select("id, user_id, neighborhood, preferred_time, venue_preference")
    .eq("status", "pending");

  if (!requests || requests.length === 0) {
    return new Response(JSON.stringify({ created: 0, message: "No pending requests" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Group into clusters
  const groups: Record<string, typeof requests> = {};
  for (const r of requests) {
    const key = `${r.neighborhood}__${r.preferred_time}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  const clusters = Object.entries(groups).filter(([, reqs]) => reqs.length >= MIN_CLUSTER_SIZE);
  let created = 0;

  for (const [clusterKey, reqs] of clusters) {
    // Skip if already created for this cluster
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("demand_cluster_key", clusterKey)
      .eq("auto_created", true)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const neighborhood = reqs[0].neighborhood;
    const preferredTime = reqs[0].preferred_time;

    // 3. Find best venue
    const { data: locations } = await supabase
      .from("locations")
      .select("id, name")
      .eq("neighborhood", neighborhood)
      .limit(1);

    if (!locations || locations.length === 0) continue;
    const venue = locations[0];

    // 4. Pick captain (most experienced)
    const userIds = reqs.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, is_table_captain, events_attended")
      .in("id", userIds)
      .order("events_attended", { ascending: false });

    const captainId = profiles?.find((p) => p.is_table_captain)?.id || profiles?.[0]?.id || userIds[0];

    // 5. Create event
    const timeSlot = TIME_SLOT_MAP[preferredTime] || TIME_SLOT_MAP.morning;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }

    const { data: event } = await supabase
      .from("events")
      .insert({
        title: `Auto-Session at ${venue.name}`,
        date: tomorrow.toISOString().split("T")[0],
        start_time: timeSlot.start,
        session_format: timeSlot.format,
        location_id: venue.id,
        neighborhood,
        max_attendees: Math.min(reqs.length + 2, 8),
        auto_created: true,
        demand_cluster_key: clusterKey,
        created_by: captainId,
        status: "upcoming",
      })
      .select("id")
      .single();

    if (!event) continue;

    // 6. Fulfill requests + auto-RSVP
    await supabase
      .from("session_requests")
      .update({ status: "fulfilled" })
      .in("id", reqs.map((r) => r.id));

    await supabase.from("rsvps").upsert(
      userIds.map((uid) => ({ event_id: event.id, user_id: uid, status: "going" })),
      { onConflict: "event_id,user_id" }
    );

    // 7. Notify
    await supabase.from("notifications").insert(
      userIds.map((uid) => ({
        user_id: uid,
        type: "session_auto_created",
        title: "Session created from your request!",
        body: "Enough people want to work together — we auto-created a session for you.",
        data: { event_id: event.id },
        read: false,
      }))
    );

    created++;
  }

  return new Response(JSON.stringify({ created, clusters: clusters.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
