/**
 * @module razorpay-webhook Edge Function
 * @description Handles Razorpay server-to-server webhooks for payment confirmation.
 *
 * This is the safety net — most payments are verified via the client-side
 * callback (razorpay-verify-payment). This webhook handles cases where the
 * user closes the browser mid-payment.
 *
 * No JWT auth — uses Razorpay webhook signature verification instead.
 *
 * @dependencies Supabase, _shared/hmac.ts
 * @tables payments, user_subscriptions, session_boosts, day_passes, event_rsvps
 * @secrets RAZORPAY_WEBHOOK_SECRET
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyHmacSha256 } from "../_shared/hmac.ts";

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
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("[RazorpayWebhook] RAZORPAY_WEBHOOK_SECRET not configured");
      return new Response("OK", { status: 200 }); // Don't retry
    }

    // Read raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    // Verify webhook signature
    const isValid = await verifyHmacSha256(rawBody, webhookSecret, signature);
    if (!isValid) {
      console.error("[RazorpayWebhook] Invalid webhook signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;

    // We only care about payment.captured and order.paid
    if (eventType !== "payment.captured" && eventType !== "order.paid") {
      return new Response("OK", { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const paymentEntity = event.payload?.payment?.entity;
    if (!paymentEntity) {
      console.error("[RazorpayWebhook] No payment entity in payload");
      return new Response("OK", { status: 200 });
    }

    const orderId = paymentEntity.order_id;
    const paymentId = paymentEntity.id;

    if (!orderId) {
      console.error("[RazorpayWebhook] No order_id in payment entity");
      return new Response("OK", { status: 200 });
    }

    // Look up payment record
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("razorpay_order_id", orderId)
      .single();

    if (!payment) {
      console.error(
        `[RazorpayWebhook] No payment record for order ${orderId}`
      );
      return new Response("OK", { status: 200 });
    }

    // Idempotency: skip if already processed
    if (payment.status === "captured" || payment.status === "completed") {
      console.log(
        `[RazorpayWebhook] Payment ${payment.id} already processed, skipping`
      );
      return new Response("OK", { status: 200 });
    }

    // Update payment status
    await supabase
      .from("payments")
      .update({
        status: "captured",
        razorpay_payment_id: paymentId,
      })
      .eq("id", payment.id);

    // Activate the purchase
    const meta = (payment.metadata as Record<string, any>) || {};
    const tierId = meta.tier_id || "plus";
    const billingCycle = meta.billing_cycle || "monthly";
    const userId = payment.user_id;

    if (payment.payment_type === "day_pass" && meta.event_id) {
      await supabase.from("day_passes").insert({
        user_id: userId,
        event_id: meta.event_id,
        amount_paise: payment.amount_paise,
        payment_id: payment.id,
        status: "active",
      });
      await supabase
        .from("event_rsvps")
        .upsert(
          { event_id: meta.event_id, user_id: userId, status: "going" },
          { onConflict: "event_id,user_id" }
        )
        .catch(() => {});
    } else if (payment.payment_type === "boost") {
      await supabase.from("session_boosts").insert({
        user_id: userId,
        boost_tier: tierId,
        amount_paise: payment.amount_paise,
        payment_id: payment.id,
      });
    } else {
      // Subscription
      const { data: existingSub } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (existingSub) {
        await supabase
          .from("user_subscriptions")
          .update({
            tier_id: tierId,
            payment_provider: "razorpay",
            payment_id: payment.id,
            billing_cycle: billingCycle,
          })
          .eq("id", existingSub.id);
      } else {
        await supabase.from("user_subscriptions").insert({
          user_id: userId,
          tier_id: tierId,
          status: "active",
          payment_provider: "razorpay",
          payment_id: payment.id,
          billing_cycle: billingCycle,
        });
      }
    }

    // Notify user
    await supabase.functions
      .invoke("send-notification", {
        body: {
          user_id: userId,
          category: "payment",
          title:
            payment.payment_type === "day_pass"
              ? "Day Pass activated!"
              : payment.payment_type === "boost"
              ? "Session Boost activated!"
              : `Welcome to ${tierId.charAt(0).toUpperCase() + tierId.slice(1)}!`,
          body: "Your payment has been confirmed and your plan is now active.",
          link: "/pricing",
        },
      })
      .catch(() => {});

    console.log(
      `[RazorpayWebhook] Payment ${payment.id} activated via webhook for user ${userId}`
    );

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[RazorpayWebhook] Error:", err);
    // Return 200 to prevent Razorpay from retrying on our errors
    return new Response("OK", { status: 200 });
  }
});
