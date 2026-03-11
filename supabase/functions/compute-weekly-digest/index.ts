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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify service role or admin
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_type")
          .eq("id", user.id)
          .single();
        if (profile?.user_type !== "admin") {
          return new Response(JSON.stringify({ error: "Not authorized" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Calculate current week's Monday
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.toISOString().split("T")[0];

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all users with at least 1 RSVP
    const { data: users } = await supabase
      .from("event_rsvps")
      .select("user_id")
      .eq("status", "going");

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uniqueUserIds = [...new Set(users.map((u: any) => u.user_id))];
    let count = 0;

    for (const userId of uniqueUserIds) {
      // Sessions attended (confirmed RSVPs in last 7 days)
      const { count: sessionsCount } = await supabase
        .from("event_rsvps")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "going")
        .gte("created_at", sevenDaysAgo);

      // Connections made in last 7 days
      const { count: connectionsCount } = await supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .gte("created_at", sevenDaysAgo);

      // Props received in last 7 days
      const { count: propsCount } = await supabase
        .from("peer_props")
        .select("id", { count: "exact", head: true })
        .eq("to_user", userId)
        .gte("created_at", sevenDaysAgo);

      const sessions = sessionsCount || 0;
      const connections = connectionsCount || 0;
      const props = propsCount || 0;

      // Get focus hours for rank progress
      const { data: profile } = await supabase
        .from("profiles")
        .select("focus_hours")
        .eq("id", userId)
        .single();

      const focusHours = Number(profile?.focus_hours ?? 0);
      const rankProgress = `${focusHours} focus hours`;

      // Generate highlight
      let highlight = "Quiet week — time for a session?";
      if (sessions >= 3) highlight = `You attended ${sessions} sessions — power week! 🔥`;
      else if (connections >= 3) highlight = `You met ${connections} new people this week!`;
      else if (props >= 2) highlight = `You received ${props} props — you're appreciated!`;
      else if (sessions >= 1) highlight = `You attended ${sessions} session${sessions > 1 ? "s" : ""} this week!`;

      // Upsert
      await supabase.from("weekly_digest_data").upsert(
        {
          user_id: userId,
          week_start: weekStart,
          sessions_attended: sessions,
          connections_made: connections,
          props_received: props,
          rank_progress: rankProgress,
          highlight,
        },
        { onConflict: "user_id,week_start" }
      );

      count++;
    }

    return new Response(JSON.stringify({ count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
