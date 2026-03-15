/**
 * @module send-notification Edge Function
 * @description Orchestrates multi-channel notification delivery.
 *
 * Channels: in_app (always), push (Web Push), email (Resend), WhatsApp (stub).
 * Respects user notification preferences and quiet hours (IST 22:00-08:00).
 *
 * @tables notifications, notification_preferences, notification_log,
 *         push_subscriptions
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPushBatch, type PushPayload } from "../_shared/webpush.ts";

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

    // Auth: only accept service_role calls (from other Edge Functions or cron)
    const authToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authToken || authToken !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Forbidden: service_role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id, category, title, body, link, data } = await req.json();

    if (!user_id || !title || !category) {
      return new Response(
        JSON.stringify({ error: "user_id, category, and title required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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

    await supabase.from("notification_log").insert({
      user_id,
      channel: "in_app",
      category,
      title,
      body,
      status: "sent",
      metadata: data || null,
    });

    // 4. Push notifications (if not in quiet hours and user has opted in)
    if (!inQuietHours && categoryEnabled && prefs?.push_enabled !== false) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", user_id);

      if (subs && subs.length > 0) {
        channels.push("push");

        const hasVapid = !!Deno.env.get("VAPID_PRIVATE_KEY");
        let pushStatus = "sent";

        if (hasVapid) {
          const pushPayload: PushPayload = {
            title,
            body: body || undefined,
            url: link || "/home",
            tag: category,
          };
          const results = await sendWebPushBatch(subs, pushPayload);
          const sent = results.filter((r) => r.success).length;
          const failed = results.filter((r) => !r.success);

          // Clean up expired subscriptions
          const expired = failed.filter((r) => r.status === 410);
          if (expired.length > 0) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .in(
                "endpoint",
                expired.map((r) => r.endpoint)
              );
          }

          pushStatus = sent > 0 ? "sent" : "failed";
          console.log(
            `[SendNotification] Push: ${sent}/${subs.length} delivered for ${user_id}`
          );
        } else {
          pushStatus = "skipped";
          console.log(
            `[SendNotification] VAPID not configured, skipping push for ${user_id}`
          );
        }

        await supabase.from("notification_log").insert({
          user_id,
          channel: "push",
          category,
          title,
          body,
          status: pushStatus,
          metadata: { subscription_count: subs.length, ...(data || {}) },
        });
      }
    }

    // 5. Email via Resend (if configured)
    if (!inQuietHours && categoryEnabled && prefs?.email_enabled !== false) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        // Get user's email
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", user_id)
          .maybeSingle();

        if (profile?.email) {
          channels.push("email");
          try {
            const emailRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "DanaDone <notifications@danadone.club>",
                to: [profile.email],
                subject: title,
                html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                  <h2 style="margin:0 0 8px">${title}</h2>
                  ${body ? `<p style="color:#666;margin:0 0 16px">${body}</p>` : ""}
                  ${link ? `<a href="https://danadone.club${link}" style="display:inline-block;padding:10px 20px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px">View on DanaDone</a>` : ""}
                  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
                  <p style="font-size:11px;color:#999">DanaDone — cowork with your people</p>
                </div>`,
              }),
            });

            const emailStatus = emailRes.ok ? "sent" : "failed";
            await supabase.from("notification_log").insert({
              user_id,
              channel: "email",
              category,
              title,
              body,
              status: emailStatus,
              metadata: { email: profile.email, ...(data || {}) },
            });
          } catch (emailErr) {
            console.error("[SendNotification] Email error:", emailErr);
            await supabase.from("notification_log").insert({
              user_id,
              channel: "email",
              category,
              title,
              body,
              status: "failed",
              metadata: {
                error: emailErr instanceof Error ? emailErr.message : String(emailErr),
                ...(data || {}),
              },
            });
          }
        }
      }
    }

    // 6. WhatsApp (stub — needs Business API or whatsapp-web.js)
    if (
      !inQuietHours &&
      categoryEnabled &&
      prefs?.whatsapp_enabled === true &&
      prefs?.whatsapp_number
    ) {
      channels.push("whatsapp");
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

    return new Response(JSON.stringify({ sent: true, channels }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[SendNotification] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
