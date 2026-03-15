/**
 * @module razorpay-verify-payment Edge Function
 * @description Verifies Razorpay payment signature and activates the purchase.
 *
 * Called from the client-side Razorpay SDK callback after successful payment.
 * Verifies HMAC-SHA256 signature, updates payment status, and activates
 * the subscription/boost/day-pass.
 *
 * @dependencies Supabase, _shared/hmac.ts
 * @tables payments, user_subscriptions, session_boosts, day_passes, event_rsvps
 * @secrets RAZORPAY_KEY_SECRET
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

    // Auth: verify the user's JWT
    const authHeader = req.headers.get("Authorization") || "";
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({ error: "Missing payment verification fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify HMAC signature: HMAC-SHA256(order_id|payment_id, key_secret)
    const message = `${razorpay_order_id}|${razorpay_payment_id}`;
    const isValid = await verifyHmacSha256(
      message,
      razorpayKeySecret,
      razorpay_signature
    );

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!isValid) {
      console.error(
        `[RazorpayVerify] Invalid signature for order ${razorpay_order_id}`
      );
      // Mark payment as failed
      await supabase
        .from("payments")
        .update({ status: "failed", razorpay_payment_id, razorpay_signature })
        .eq("razorpay_order_id", razorpay_order_id)
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({ success: false, error: "Invalid payment signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the payment record (scoped to this user for security)
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .eq("user_id", user.id)
      .single();

    if (!payment) {
      return new Response(
        JSON.stringify({ error: "Payment record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency: if already captured, return success
    if (payment.status === "captured" || payment.status === "completed") {
      return new Response(
        JSON.stringify({ success: true, already_processed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update payment status to captured
    await supabase
      .from("payments")
      .update({
        status: "captured",
        razorpay_payment_id,
        razorpay_signature,
      })
      .eq("id", payment.id);

    // Activate the purchase
    const meta = payment.metadata as Record<string, any> || {};
    const tierId = meta.tier_id || "plus";
    const billingCycle = meta.billing_cycle || "monthly";

    await activatePurchase(supabase, {
      userId: user.id,
      paymentId: payment.id,
      paymentType: payment.payment_type,
      amountPaise: payment.amount_paise,
      tierId,
      billingCycle,
      eventId: meta.event_id,
    });

    // Notify user
    await supabase.functions.invoke("send-notification", {
      body: {
        user_id: user.id,
        category: "payment",
        title:
          payment.payment_type === "day_pass"
            ? "Day Pass activated!"
            : payment.payment_type === "boost"
            ? "Session Boost activated!"
            : `Welcome to ${tierId.charAt(0).toUpperCase() + tierId.slice(1)}!`,
        body:
          payment.payment_type === "day_pass"
            ? "Your day pass is active. You're RSVP'd — see you at the session!"
            : payment.payment_type === "boost"
            ? "Your 24-hour boost is now active. Enjoy the premium features!"
            : "Your payment has been verified and your plan is now active.",
        link:
          payment.payment_type === "day_pass"
            ? `/events/${meta.event_id || ""}`
            : payment.payment_type === "boost"
            ? "/home"
            : "/pricing",
      },
    }).catch(() => {}); // Non-blocking

    console.log(
      `[RazorpayVerify] Payment ${payment.id} captured for user ${user.id}`
    );

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[RazorpayVerify] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Activate the purchased product (subscription, boost, or day pass).
 * Mirrors the admin PendingPayments.verifyPayment() logic server-side.
 */
async function activatePurchase(
  supabase: any,
  opts: {
    userId: string;
    paymentId: string;
    paymentType: string;
    amountPaise: number;
    tierId: string;
    billingCycle: string;
    eventId?: string;
  }
) {
  const { userId, paymentId, paymentType, amountPaise, tierId, billingCycle, eventId } = opts;

  if (paymentType === "day_pass" && eventId) {
    await supabase.from("day_passes").insert({
      user_id: userId,
      event_id: eventId,
      amount_paise: amountPaise,
      payment_id: paymentId,
      status: "active",
    });
    // Auto-RSVP
    await supabase
      .from("event_rsvps")
      .upsert(
        { event_id: eventId, user_id: userId, status: "going" },
        { onConflict: "event_id,user_id" }
      )
      .catch(() => {});
  } else if (paymentType === "boost") {
    await supabase.from("session_boosts").insert({
      user_id: userId,
      boost_tier: tierId,
      amount_paise: amountPaise,
      payment_id: paymentId,
    });
  } else {
    // Subscription — upsert
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
          payment_id: paymentId,
          billing_cycle: billingCycle,
        })
        .eq("id", existingSub.id);
    } else {
      await supabase.from("user_subscriptions").insert({
        user_id: userId,
        tier_id: tierId,
        status: "active",
        payment_provider: "razorpay",
        payment_id: paymentId,
        billing_cycle: billingCycle,
      });
    }
  }
}
