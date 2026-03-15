/**
 * @module send-push Edge Function
 * @description Sends Web Push notifications to a user's registered devices.
 *
 * Uses VAPID-signed Web Push protocol (RFC 8291 + 8292) via the shared
 * webpush module. Falls back to logging if VAPID keys aren't configured.
 *
 * Expects Supabase secrets: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT
 *
 * @tables push_subscriptions, notification_log
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
    // Auth: only accept service_role calls (from send-notification or other Edge Functions)
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authToken || authToken !== serviceKey) {
      return new Response(
        JSON.stringify({ error: "Forbidden: service_role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id, title, body, url, tag } = await req.json();
    if (!user_id || !title) {
      return new Response(
        JSON.stringify({ error: "user_id and title required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user's push subscriptions
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (error) {
      console.error("[SendPush] DB error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: PushPayload = { title, body, url, tag };

    // Check if VAPID keys are configured
    const hasVapid = !!Deno.env.get("VAPID_PRIVATE_KEY");

    if (!hasVapid) {
      // Fallback: log only (dev mode)
      console.log(
        `[SendPush] VAPID not configured. Would send to ${subscriptions.length} subscription(s):`,
        payload
      );
      return new Response(
        JSON.stringify({
          sent: 0,
          attempted: subscriptions.length,
          message: "VAPID keys not configured — logged only",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send real push notifications
    const results = await sendWebPushBatch(subscriptions, payload);

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    // Remove expired subscriptions (410 Gone)
    const expired = failed.filter((r) => r.status === 410);
    if (expired.length > 0) {
      const expiredEndpoints = expired.map((r) => r.endpoint);
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
      console.log(
        `[SendPush] Removed ${expired.length} expired subscription(s)`
      );
    }

    // Log failures (non-410)
    const errors = failed.filter((r) => r.status !== 410);
    if (errors.length > 0) {
      console.error("[SendPush] Failed deliveries:", errors);
    }

    console.log(
      `[SendPush] Sent ${sent}/${subscriptions.length} for user ${user_id}`
    );

    return new Response(
      JSON.stringify({
        sent,
        failed: failed.length,
        expired: expired.length,
        total: subscriptions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SendPush] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
