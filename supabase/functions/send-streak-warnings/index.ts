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

    // Find users with active streaks (>= 2)
    const { data: streakUsers, error: streakErr } = await supabase
      .from("profiles")
      .select("id, current_streak, display_name")
      .gte("current_streak", 2);

    if (streakErr) {
      console.error("[StreakWarnings] Error fetching streaks:", streakErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch streak users" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!streakUsers || streakUsers.length === 0) {
      return new Response(
        JSON.stringify({ warnings_sent: 0, message: "No at-risk users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get date range: next 3 days
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split("T")[0];
    const futureStr = threeDaysLater.toISOString().split("T")[0];

    let warningsSent = 0;

    for (const user of streakUsers) {
      // Check if user has any upcoming RSVPs in next 3 days
      const { data: rsvps } = await supabase
        .from("event_rsvps")
        .select("id, events!inner(date)")
        .eq("user_id", user.id)
        .eq("status", "going")
        .gte("events.date", todayStr)
        .lte("events.date", futureStr)
        .limit(1);

      if (rsvps && rsvps.length > 0) continue; // User has a session coming up

      // Send streak warning via send-notification
      const notifPayload = {
        user_id: user.id,
        category: "streak_warning",
        title: `Your ${user.current_streak}-week streak is at risk! 🔥`,
        body: "Book a session by Sunday to keep your streak alive.",
        link: "/events",
      };

      await supabase.functions.invoke("send-notification", {
        body: notifPayload,
      });

      warningsSent++;
    }

    return new Response(
      JSON.stringify({ warnings_sent: warningsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[StreakWarnings] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
