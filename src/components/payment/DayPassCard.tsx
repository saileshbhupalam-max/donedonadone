/**
 * @module DayPassCard
 * @description Day pass purchase card shown on EventDetail for users who want
 * single-session access. Shows pricing (₹100 for 2hr / ₹150 for 4hr) and
 * opens PaymentModal with day_pass payment type.
 *
 * After admin verifies payment, the user gets:
 * - An active day_pass record for this event
 * - An automatic RSVP to the event
 *
 * @key-exports DayPassCard
 * @dependencies PaymentModal, supabase
 * @tables day_passes, payments
 */

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ticket, IndianRupee, Clock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PaymentModal } from "./PaymentModal";

interface DayPassCardProps {
  eventId: string;
  eventTitle: string;
  startTime: string | null;
  endTime: string | null;
}

/** Platform fee: ₹100 for sessions ≤ 2hr, ₹150 for longer */
function getDayPassPricePaise(
  startTime: string | null,
  endTime: string | null
): number {
  if (!startTime || !endTime) return 10000; // Default ₹100

  // Parse HH:MM times
  const [sH, sM] = startTime.split(":").map(Number);
  const [eH, eM] = endTime.split(":").map(Number);
  const durationMinutes = (eH * 60 + eM) - (sH * 60 + sM);

  // > 2 hours = ₹150, else ₹100
  return durationMinutes > 120 ? 15000 : 10000;
}

export function DayPassCard({
  eventId,
  eventTitle,
  startTime,
  endTime,
}: DayPassCardProps) {
  const { user } = useAuth();
  const [existingPass, setExistingPass] = useState<{
    status: string;
    access_code: string;
  } | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [loading, setLoading] = useState(true);

  const pricePaise = getDayPassPricePaise(startTime, endTime);
  const priceRupees = pricePaise / 100;

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("day_passes")
        .select("status, access_code")
        .eq("user_id", user.id)
        .eq("event_id", eventId)
        .in("status", ["pending", "active"])
        .maybeSingle();
      setExistingPass(data);
      setLoading(false);
    })();
  }, [user, eventId]);

  if (loading) return null;

  // Already has an active day pass
  if (existingPass?.status === "active") {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
            <Check className="w-5 h-5 text-green-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Day Pass active</p>
            <p className="text-xs text-muted-foreground">
              Access code: <code className="font-mono text-foreground">{existingPass.access_code}</code>
            </p>
          </div>
          <Badge variant="default" className="text-xs">Active</Badge>
        </CardContent>
      </Card>
    );
  }

  // Pending verification
  if (existingPass?.status === "pending") {
    return (
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Payment pending verification</p>
            <p className="text-xs text-muted-foreground">
              We'll activate your day pass shortly.
            </p>
          </div>
          <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-600">Pending</Badge>
        </CardContent>
      </Card>
    );
  }

  // Show purchase option
  return (
    <>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Ticket className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Day Pass</p>
              <p className="text-xs text-muted-foreground">
                Single session access — no subscription needed
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-foreground flex items-center">
                <IndianRupee className="w-4 h-4" />
                {priceRupees}
              </p>
              <p className="text-[10px] text-muted-foreground">one session</p>
            </div>
          </div>

          <Button className="w-full" onClick={() => setShowPayment(true)}>
            <Ticket className="w-4 h-4 mr-1" />
            Buy Day Pass
          </Button>
        </div>
      </Card>

      {showPayment && (
        <PaymentModal
          open
          onOpenChange={setShowPayment}
          tierName="Day Pass"
          tierId="day_pass"
          amountPaise={pricePaise}
          paymentType="day_pass"
          metadata={{ event_id: eventId, event_title: eventTitle }}
        />
      )}
    </>
  );
}
