import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Find RSVPs for tomorrow's events
    const { data: rsvps, error } = await supabase
      .from("event_rsvps")
      .select("user_id, event_id, events!inner(title, venue_name, start_time, date)")
      .eq("status", "going")
      .eq("events.date", tomorrowStr);

    if (error) {
      console.error("[SessionReminders] Error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch RSVPs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rsvps || rsvps.length === 0) {
      return new Response(
        JSON.stringify({ reminders_sent: 0, message: "No sessions tomorrow" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let remindersSent = 0;

    for (const rsvp of rsvps) {
      const event = rsvp.events as any;
      const venueName = event?.venue_name || "the venue";
      const time = event?.start_time || "";
      const title = event?.title || "a session";

      const notifPayload = {
        user_id: rsvp.user_id,
        category: "session_reminder",
        title: "Session tomorrow! 📍",
        body: `Your session "${title}" at ${venueName}${time ? ` at ${time}` : ""} is tomorrow. See you there!`,
        link: `/events/${rsvp.event_id}`,
      };

      await supabase.functions.invoke("send-notification", {
        body: notifPayload,
      });

      remindersSent++;
    }

    return new Response(
      JSON.stringify({ reminders_sent: remindersSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SessionReminders] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
