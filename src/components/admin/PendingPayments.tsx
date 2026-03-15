/**
 * @module PendingPayments
 * @description Admin component to review and verify UPI payments.
 *
 * When a user pays via UPI and submits their UTR, the payment lands in
 * the `payments` table with status "pending_verification". This component
 * lets admins verify the UTR against their bank statement and activate
 * the user's subscription or session boost.
 *
 * @key-exports PendingPayments
 * @dependencies supabase
 * @tables payments, user_subscriptions, session_boosts, profiles
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Check, X, IndianRupee, Clock, AlertCircle } from "lucide-react";

interface PendingPayment {
  id: string;
  user_id: string;
  amount_paise: number;
  payment_id: string | null;
  payment_type: string;
  status: string;
  created_at: string;
  metadata: {
    tier_id?: string;
    billing_cycle?: string;
    upi_vpa?: string;
    submitted_at?: string;
  } | null;
  // Joined
  profile?: {
    display_name: string | null;
    email: string | null;
  };
}

export function PendingPayments() {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("*, profile:profiles!payments_user_id_fkey(display_name, email)")
      .in("status", ["pending_verification", "verified", "rejected"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Failed to load payments");
      return;
    }

    setPayments(
      (data || []).map((p: any) => ({
        ...p,
        profile: Array.isArray(p.profile) ? p.profile[0] : p.profile,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // Realtime updates for new payments
  useEffect(() => {
    const channel = supabase
      .channel("admin_payments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => fetchPayments()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPayments]);

  const verifyPayment = async (payment: PendingPayment) => {
    setProcessingId(payment.id);
    try {
      // 1. Mark payment as verified
      const { error: payError } = await supabase
        .from("payments")
        .update({ status: "verified" })
        .eq("id", payment.id);
      if (payError) throw payError;

      const tierId = payment.metadata?.tier_id || "plus";
      const billingCycle = payment.metadata?.billing_cycle || "monthly";

      if (payment.payment_type === "day_pass") {
        // 2a. Activate day pass + auto-RSVP
        const eventId = payment.metadata?.event_id;
        if (eventId) {
          await supabase.from("day_passes").insert({
            user_id: payment.user_id,
            event_id: eventId,
            amount_paise: payment.amount_paise,
            payment_id: payment.id,
            status: "active",
          });
          // Auto-RSVP the user to the event
          await supabase.from("event_rsvps").upsert(
            { event_id: eventId, user_id: payment.user_id, status: "going" },
            { onConflict: "event_id,user_id" }
          ).catch(() => {}); // Non-blocking if already RSVP'd
        }
      } else if (payment.payment_type === "boost") {
        // 2b. Create session boost
        const { error: boostError } = await supabase.from("session_boosts").insert({
          user_id: payment.user_id,
          boost_tier: tierId,
          amount_paise: payment.amount_paise,
          payment_id: payment.id,
        });
        if (boostError) throw boostError;
      } else {
        // 2b. Activate subscription — upsert so we handle both new and existing subs
        const { data: existingSub } = await supabase
          .from("user_subscriptions")
          .select("id")
          .eq("user_id", payment.user_id)
          .eq("status", "active")
          .maybeSingle();

        if (existingSub) {
          const { error: subError } = await supabase
            .from("user_subscriptions")
            .update({
              tier_id: tierId,
              payment_provider: "upi",
              payment_id: payment.id,
              billing_cycle: billingCycle,
            })
            .eq("id", existingSub.id);
          if (subError) throw subError;
        } else {
          const { error: subError } = await supabase
            .from("user_subscriptions")
            .insert({
              user_id: payment.user_id,
              tier_id: tierId,
              status: "active",
              payment_provider: "upi",
              payment_id: payment.id,
              billing_cycle: billingCycle,
            });
          if (subError) throw subError;
        }
      }

      // 3. Notify the user their payment was verified
      await supabase.functions.invoke("send-notification", {
        body: {
          user_id: payment.user_id,
          category: "payment",
          title: payment.payment_type === "day_pass"
            ? "Day Pass activated!"
            : payment.payment_type === "boost"
            ? "Session Boost activated!"
            : `Welcome to ${tierId.charAt(0).toUpperCase() + tierId.slice(1)}!`,
          body: payment.payment_type === "day_pass"
            ? "Your day pass is active. You're RSVP'd — see you at the session!"
            : payment.payment_type === "boost"
            ? "Your 24-hour boost is now active. Enjoy the premium features!"
            : "Your payment has been verified and your plan is now active.",
          link: payment.payment_type === "day_pass"
            ? `/events/${payment.metadata?.event_id || ""}`
            : payment.payment_type === "boost" ? "/home" : "/pricing",
        },
      }).catch(() => {}); // Non-blocking — don't fail verification if notification fails

      toast.success(
        `Verified! ${payment.profile?.display_name || "User"} now has ${
          payment.payment_type === "boost" ? "a session boost" : `${tierId} plan`
        }`
      );
      fetchPayments();
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    } finally {
      setProcessingId(null);
    }
  };

  const rejectPayment = async (payment: PendingPayment) => {
    setProcessingId(payment.id);
    try {
      const { error } = await supabase
        .from("payments")
        .update({ status: "rejected" })
        .eq("id", payment.id);
      if (error) throw error;
      toast.success("Payment rejected");
      fetchPayments();
    } catch (e: any) {
      toast.error(e.message || "Failed to reject");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <Skeleton className="h-40" />;

  const pending = payments.filter((p) => p.status === "pending_verification");
  const processed = payments.filter((p) => p.status !== "pending_verification");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Payment Verification</CardTitle>
          {pending.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {pending.length} pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending.length === 0 && processed.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No payments yet</p>
        )}

        {/* Pending payments */}
        {pending.map((p) => (
          <div
            key={p.id}
            className="border rounded-lg p-3 space-y-2 border-yellow-500/30 bg-yellow-500/5"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {p.profile?.display_name || p.profile?.email || "Unknown"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {p.profile?.email}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] gap-1 shrink-0 border-yellow-500/50 text-yellow-600">
                <Clock className="w-3 h-3" />
                Pending
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Amount: <strong className="text-foreground">₹{(p.amount_paise / 100).toLocaleString("en-IN")}</strong>
              </span>
              <span>
                Type: <strong className="text-foreground">{p.payment_type === "boost" ? "Session Boost" : "Subscription"}</strong>
              </span>
              <span>
                UTR: <strong className="text-foreground font-mono">{p.payment_id || "—"}</strong>
              </span>
              <span>
                Tier: <strong className="text-foreground">{p.metadata?.tier_id || "plus"}</strong>
              </span>
              <span className="col-span-2">
                Submitted: <strong className="text-foreground">
                  {format(parseISO(p.created_at), "MMM d, h:mm a")}
                </strong>
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 gap-1"
                onClick={() => verifyPayment(p)}
                disabled={processingId === p.id}
              >
                <Check className="w-3.5 h-3.5" />
                {processingId === p.id ? "Verifying..." : "Verify & Activate"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => rejectPayment(p)}
                disabled={processingId === p.id}
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </Button>
            </div>
          </div>
        ))}

        {/* Processed payments */}
        {processed.length > 0 && (
          <>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider pt-2">
              Recent ({processed.length})
            </p>
            {processed.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {p.profile?.display_name || p.profile?.email || "Unknown"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    ₹{(p.amount_paise / 100).toLocaleString("en-IN")} · UTR: {p.payment_id || "—"} · {format(parseISO(p.created_at), "MMM d")}
                  </p>
                </div>
                <Badge
                  variant={p.status === "verified" ? "default" : "destructive"}
                  className="text-[10px]"
                >
                  {p.status === "verified" ? "Verified" : "Rejected"}
                </Badge>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
