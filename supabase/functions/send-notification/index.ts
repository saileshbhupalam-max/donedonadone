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

    const { user_id, category, title, body, link, data } = await req.json();

    if (!user_id || !title || !category) {
      return new Response(
        JSON.stringify({ error: "user_id, category, and title required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const channels: string[] = ["in_app"];

    // 1. Fetch notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    const channelSettings = prefs?.channels as Record<string, boolean> | null;
    const categoryEnabled =
      !channelSettings || channelSettings[category] !== false;

    // 2. Check quiet hours (IST = UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const currentMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();

    const quietStart = prefs?.quiet_hours_start || "22:00";
    const quietEnd = prefs?.quiet_hours_end || "08:00";
    const [qsH, qsM] = quietStart.split(":").map(Number);
    const [qeH, qeM] = quietEnd.split(":").map(Number);
    const qsMin = qsH * 60 + qsM;
    const qeMin = qeH * 60 + qeM;

    let inQuietHours = false;
    if (qsMin > qeMin) {
      // Overnight (e.g. 22:00 - 08:00)
      inQuietHours = currentMinutes >= qsMin || currentMinutes < qeMin;
    } else {
      inQuietHours = currentMinutes >= qsMin && currentMinutes < qeMin;
    }

    // 3. Always create in-app notification
    await supabase.from("notifications").insert({
      user_id,
      type: category,
      title,
      body: body || null,
      link: link || null,
    });

    // Log in-app
    await supabase.from("notification_log").insert({
      user_id,
      channel: "in_app",
      category,
      title,
      body,
      status: "sent",
      metadata: data || null,
    });

    // 4. Push notifications (if not in quiet hours)
    if (
      !inQuietHours &&
      categoryEnabled &&
      prefs?.push_enabled !== false
    ) {
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", true);

      if (tokens && tokens.length > 0) {
        // Also check push_subscriptions (legacy)
        channels.push("push");

        // Web Push requires VAPID signing - log for now
        console.log(
          `[SendNotification] Would push to ${tokens.length} token(s) for ${user_id}:`,
          { title, body }
        );

        await supabase.from("notification_log").insert({
          user_id,
          channel: "push",
          category,
          title,
          body,
          status: "sent",
          metadata: { token_count: tokens.length, ...(data || {}) },
        });
      }
    }

    // 5. WhatsApp (stub)
    if (
      !inQuietHours &&
      categoryEnabled &&
      prefs?.whatsapp_enabled === true &&
      prefs?.whatsapp_number
    ) {
      channels.push("whatsapp");

      // TODO: Integrate WhatsApp Business API or whatsapp-web.js
      await supabase.from("notification_log").insert({
        user_id,
        channel: "whatsapp",
        category,
        title,
        body,
        status: "queued",
        metadata: { phone: prefs.whatsapp_number, ...(data || {}) },
      });
    }

    return new Response(
      JSON.stringify({ sent: true, channels }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SendNotification] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
