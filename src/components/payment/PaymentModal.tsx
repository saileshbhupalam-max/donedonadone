/**
 * @module PaymentModal
 * @description Dual-mode payment flow: Razorpay checkout (primary) + UPI QR (fallback).
 *
 * Flow (Razorpay):
 * 1. User clicks "Pay Now" → Razorpay popup opens
 * 2. User pays via UPI/card/netbanking inside Razorpay
 * 3. Signature verified server-side → subscription/boost/pass activated instantly
 *
 * Flow (UPI QR fallback):
 * 1. Shows UPI QR code + VPA for manual entry
 * 2. User pays via any UPI app, enters UTR number
 * 3. Admin verifies UTR → activates subscription
 *
 * @key-exports PaymentModal
 * @dependencies qrcode.react, supabase, useAuth, useRazorpay
 * @tables payments, user_subscriptions, session_boosts
 */

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRazorpay } from "@/hooks/useRazorpay";
import { trackConversion } from "@/lib/trackConversion";
import { Copy, Check, IndianRupee, QrCode, ArrowRight, Clock, Smartphone, CreditCard, ShieldCheck } from "lucide-react";

const UPI_VPA = import.meta.env.VITE_UPI_VPA || "danadone@upi";
const UPI_PAYEE_NAME = import.meta.env.VITE_UPI_PAYEE_NAME || "DanaDone";

type PaymentType = "subscription" | "boost" | "day_pass";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tierName: string;
  tierId: string;
  amountPaise: number;
  billingCycle?: "monthly" | "yearly";
  paymentType?: PaymentType;
  metadata?: Record<string, unknown>;
}

type Step = "choose" | "qr" | "utr" | "submitted" | "success";

function buildUpiUrl(amountRupees: number, note: string): string {
  const params = new URLSearchParams({
    pa: UPI_VPA,
    pn: UPI_PAYEE_NAME,
    am: amountRupees.toFixed(2),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

export function PaymentModal({
  open,
  onOpenChange,
  tierName,
  tierId,
  amountPaise,
  billingCycle = "monthly",
  paymentType = "subscription",
  metadata: extraMetadata,
}: PaymentModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("choose");
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const amountRupees = amountPaise / 100;
  const note = paymentType === "boost"
    ? `DanaDone Session Boost - ${tierName}`
    : `DanaDone ${tierName} - ${billingCycle}`;
  const upiUrl = buildUpiUrl(amountRupees, note);

  const { pay: razorpayPay, loading: razorpayLoading } = useRazorpay({
    onSuccess: () => {
      setStep("success");
      toast.success("Payment confirmed!");
    },
    onFailure: (error) => {
      if (error === "Payment cancelled") {
        toast.info("Payment cancelled");
      } else {
        toast.error(error || "Payment failed. Please try again.");
      }
    },
  });

  const handleRazorpayPay = () => {
    razorpayPay({
      tierId,
      paymentType,
      billingCycle,
      eventId: extraMetadata?.event_id as string | undefined,
      tierName,
      amountPaise,
    });
  };

  const copyVpa = async () => {
    await navigator.clipboard.writeText(UPI_VPA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitUtr = async () => {
    if (!user) return;
    const trimmed = utr.trim();
    if (trimmed.length < 6) {
      toast.error("Please enter a valid UTR/transaction reference number.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("payments").insert({
        user_id: user.id,
        amount_paise: amountPaise,
        payment_provider: "upi",
        payment_type: paymentType,
        payment_id: trimmed,
        status: "pending_verification",
        metadata: {
          tier_id: tierId,
          billing_cycle: billingCycle,
          upi_vpa: UPI_VPA,
          submitted_at: new Date().toISOString(),
          ...extraMetadata,
        },
      });

      if (error) throw error;

      trackConversion("payment_submitted", {
        tier: tierId,
        type: paymentType,
        amount: amountPaise,
        provider: "upi",
      });

      setStep("submitted");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep("choose");
    setUtr("");
    setSubmitting(false);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {paymentType === "boost" ? "Session Boost" : `Upgrade to ${tierName}`}
          </DialogTitle>
        </DialogHeader>

        {/* Step: Choose payment method */}
        {step === "choose" && (
          <div className="space-y-5">
            {/* Amount */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Amount</span>
              <div className="flex items-center gap-1">
                <IndianRupee className="w-4 h-4 text-foreground" />
                <span className="text-2xl font-bold text-foreground">
                  {amountRupees.toLocaleString("en-IN")}
                </span>
                {paymentType === "subscription" && (
                  <span className="text-xs text-muted-foreground ml-1">
                    /{billingCycle === "yearly" ? "year" : "month"}
                  </span>
                )}
              </div>
            </div>

            {/* Razorpay — Primary */}
            <Button
              className="w-full gap-2 h-12 text-base"
              onClick={handleRazorpayPay}
              disabled={razorpayLoading}
            >
              <CreditCard className="w-5 h-5" />
              {razorpayLoading ? "Opening payment..." : "Pay Now"}
            </Button>
            <div className="flex items-center justify-center gap-1.5 -mt-2">
              <ShieldCheck className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                UPI, Cards, Netbanking — powered by Razorpay
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-[10px] text-muted-foreground uppercase">or</span>
              <Separator className="flex-1" />
            </div>

            {/* UPI QR — Fallback */}
            <Button
              variant="outline"
              className="w-full gap-2 text-sm"
              onClick={() => setStep("qr")}
            >
              <QrCode className="w-4 h-4" />
              Pay manually via UPI QR
            </Button>
          </div>
        )}

        {/* Step: UPI QR code */}
        {step === "qr" && (
          <div className="space-y-5">
            {/* QR Code */}
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <QRCodeSVG
                  value={upiUrl}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Scan with any UPI app
              </p>
            </div>

            {/* UPI VPA for manual entry */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Or pay manually to UPI ID</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono text-foreground">
                  {UPI_VPA}
                </code>
                <Button variant="outline" size="sm" onClick={copyVpa} className="shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">How to pay</p>
              <div className="space-y-1.5">
                {[
                  { icon: Smartphone, text: "Open any UPI app (GPay, PhonePe, Paytm)" },
                  { icon: QrCode, text: "Scan the QR code or enter the UPI ID" },
                  { icon: IndianRupee, text: `Pay ₹${amountRupees.toLocaleString("en-IN")}` },
                  { icon: ArrowRight, text: "Come back here and enter your UTR number" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={() => setStep("utr")}>
              I've made the payment
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setStep("choose")}>
              Back to payment options
            </Button>
          </div>
        )}

        {/* Step: Enter UTR */}
        {step === "utr" && (
          <div className="space-y-5">
            <div className="px-4 py-3 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                Paid <strong className="text-foreground">₹{amountRupees.toLocaleString("en-IN")}</strong> to{" "}
                <strong className="text-foreground">{UPI_VPA}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="utr">UTR / Transaction Reference Number</Label>
              <Input
                id="utr"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="e.g. 412345678901"
                className="font-mono"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">
                Find this in your UPI app's transaction history. It's usually a 12-digit number.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("qr")}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmitUtr}
                disabled={submitting || utr.trim().length < 6}
              >
                {submitting ? "Submitting..." : "Confirm Payment"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: UPI submitted (pending manual verification) */}
        {step === "submitted" && (
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-lg text-foreground">Payment submitted!</h3>
              <p className="text-sm text-muted-foreground">
                We'll verify your payment and activate your{" "}
                {paymentType === "day_pass" ? "Day Pass" : paymentType === "boost" ? "Session Boost" : `${tierName} plan`} shortly.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Usually verified within 30 minutes</span>
            </div>

            <Badge variant="outline" className="text-xs font-mono">
              UTR: {utr.trim()}
            </Badge>

            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}

        {/* Step: Razorpay payment confirmed (instant) */}
        {step === "success" && (
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-500" />
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-lg text-foreground">Payment confirmed!</h3>
              <p className="text-sm text-muted-foreground">
                Your{" "}
                {paymentType === "day_pass" ? "Day Pass" : paymentType === "boost" ? "Session Boost" : `${tierName} plan`}
                {" "}is now active.
              </p>
            </div>

            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
