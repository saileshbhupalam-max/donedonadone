/**
 * @module razorpay-create-order Edge Function
 * @description Creates a Razorpay order and a pending payment record.
 *
 * Flow: Client calls this → we create a Razorpay order → insert a payments
 * row with status 'created' → return order details for the Razorpay SDK.
 *
 * @dependencies Razorpay Orders API, Supabase
 * @tables payments, subscription_tiers
 * @secrets RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
 */

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")!;
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

    const { tier_id, payment_type, billing_cycle, event_id } = await req.json();

    if (!payment_type) {
      return new Response(
        JSON.stringify({ error: "payment_type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine amount
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let amountPaise: number;
    let description: string;

    if (payment_type === "subscription") {
      const { data: tier } = await supabase
        .from("subscription_tiers")
        .select("name, price_monthly, price_yearly")
        .eq("id", tier_id)
        .single();

      if (!tier) {
        return new Response(
          JSON.stringify({ error: "Invalid tier" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      amountPaise =
        billing_cycle === "yearly" ? tier.price_yearly : tier.price_monthly;

      if (!amountPaise || amountPaise <= 0) {
        return new Response(
          JSON.stringify({ error: "This is a free tier — no payment needed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      description = `DanaDone ${tier.name} - ${billing_cycle || "monthly"}`;
    } else if (payment_type === "boost") {
      amountPaise = 9900; // ₹99
      description = "DanaDone Session Boost (24hr)";
    } else if (payment_type === "day_pass") {
      // Day pass pricing: ₹100 (2hr) or ₹150 (4hr) — passed from client
      // Default to ₹100 if not specified
      amountPaise = 10000;
      description = "DanaDone Day Pass";
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid payment_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Razorpay order
    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const receipt = `dd_${user.id.slice(0, 8)}_${Date.now()}`;

    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: {
          user_id: user.id,
          payment_type,
          tier_id: tier_id || "",
          event_id: event_id || "",
        },
      }),
    });

    if (!rzpRes.ok) {
      const rzpError = await rzpRes.text();
      console.error("[RazorpayCreateOrder] Razorpay API error:", rzpError);
      return new Response(
        JSON.stringify({ error: "Failed to create payment order" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rzpOrder = await rzpRes.json();

    // Insert pending payment record
    const { data: payment, error: payError } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        amount_paise: amountPaise,
        payment_type,
        payment_provider: "razorpay",
        status: "created",
        razorpay_order_id: rzpOrder.id,
        metadata: {
          tier_id: tier_id || null,
          billing_cycle: billing_cycle || null,
          event_id: event_id || null,
          receipt,
          description,
        },
      })
      .select("id")
      .single();

    if (payError) {
      console.error("[RazorpayCreateOrder] DB insert error:", payError);
      return new Response(
        JSON.stringify({ error: "Failed to record payment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile for prefill
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        order_id: rzpOrder.id,
        amount: amountPaise,
        currency: "INR",
        key_id: razorpayKeyId,
        payment_db_id: payment.id,
        prefill: {
          name: profile?.display_name || "",
          email: profile?.email || user.email || "",
        },
        description,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[RazorpayCreateOrder] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
