/**
 * @module useRazorpay
 * @description React hook for Razorpay Standard Checkout integration.
 *
 * Handles: script loading → order creation → Razorpay popup → signature
 * verification → purchase activation. Falls back gracefully if the
 * Razorpay script fails to load.
 *
 * @key-exports useRazorpay
 * @dependencies supabase, AuthContext
 */

import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackConversion } from "@/lib/trackConversion";

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

interface UseRazorpayOptions {
  onSuccess: () => void;
  onFailure: (error: string) => void;
}

interface PayParams {
  tierId: string;
  paymentType: "subscription" | "boost" | "day_pass";
  billingCycle?: "monthly" | "yearly";
  eventId?: string;
  tierName: string;
  amountPaise: number;
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const existing = document.querySelector(
      `script[src="${RAZORPAY_SCRIPT_URL}"]`
    );
    if (existing) {
      // Script tag exists but Razorpay not yet available — wait for it
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Razorpay SDK"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.head.appendChild(script);
  });
}

export function useRazorpay({ onSuccess, onFailure }: UseRazorpayOptions) {
  const [loading, setLoading] = useState(false);
  const processingRef = useRef(false);

  const pay = useCallback(
    async (params: PayParams) => {
      // Prevent double-clicks
      if (processingRef.current) return;
      processingRef.current = true;
      setLoading(true);

      try {
        // 1. Load Razorpay script
        await loadRazorpayScript();

        // 2. Create order via Edge Function
        const { data, error } = await supabase.functions.invoke(
          "razorpay-create-order",
          {
            body: {
              tier_id: params.tierId,
              payment_type: params.paymentType,
              billing_cycle: params.billingCycle,
              event_id: params.eventId,
            },
          }
        );

        if (error || !data?.order_id) {
          throw new Error(
            data?.error || error?.message || "Failed to create order"
          );
        }

        // 3. Open Razorpay checkout
        const options: RazorpayOptions = {
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          name: "DanaDone",
          description: data.description || params.tierName,
          order_id: data.order_id,
          prefill: data.prefill,
          theme: { color: "#7c3aed" },
          handler: async (response: RazorpayResponse) => {
            // 4. Verify payment signature server-side
            try {
              const { data: verifyData, error: verifyError } =
                await supabase.functions.invoke("razorpay-verify-payment", {
                  body: {
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  },
                });

              if (verifyError || !verifyData?.success) {
                throw new Error(
                  verifyData?.error ||
                    verifyError?.message ||
                    "Payment verification failed"
                );
              }

              trackConversion("payment_completed", {
                tier: params.tierId,
                type: params.paymentType,
                amount: params.amountPaise,
                provider: "razorpay",
              });

              onSuccess();
            } catch (e: any) {
              onFailure(e.message || "Payment verification failed");
            } finally {
              processingRef.current = false;
              setLoading(false);
            }
          },
          modal: {
            ondismiss: () => {
              processingRef.current = false;
              setLoading(false);
              onFailure("Payment cancelled");
            },
          },
        };

        const rzp = new window.Razorpay!(options);
        rzp.open();

        // Note: loading stays true until handler/ondismiss fires
      } catch (e: any) {
        processingRef.current = false;
        setLoading(false);
        onFailure(e.message || "Payment failed");
      }
    },
    [onSuccess, onFailure]
  );

  return { pay, loading };
}
