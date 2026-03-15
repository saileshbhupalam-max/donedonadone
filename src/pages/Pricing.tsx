import { useMemo, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { trackConversion } from "@/lib/trackConversion";
import { useSubscription, TierId } from "@/hooks/useSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Minus, Lock, Zap, Sparkles, Crown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PaymentModal } from "@/components/payment/PaymentModal";

const BORDER_COLORS: Record<string, string> = {
  gray: "border-t-muted-foreground",
  blue: "border-t-blue-500",
  purple: "border-t-purple-500",
  gold: "border-t-yellow-500",
};

const CATEGORY_LABELS: Record<string, string> = {
  discovery: "Discovery",
  connections: "Connections",
  matching: "Matching",
  community: "Community",
  gamification: "Gamification",
  analytics: "Analytics",
  company: "Company",
  ai: "AI Features",
};

export default function Pricing() {
  usePageTitle("Plans — DanaDone");
  const { tier, allTiers, allFeatures, allLimits, loading } = useSubscription();

  useEffect(() => { trackConversion("viewed_pricing"); }, []);

  // Personalized header from gate context
  const gateFeature = useMemo(() => {
    const feat = sessionStorage.getItem("last_gate_feature");
    if (feat) sessionStorage.removeItem("last_gate_feature");
    return feat;
  }, []);

  const featuresByCategory = useMemo(() => {
    const grouped: Record<string, typeof allFeatures> = {};
    allFeatures.forEach((f) => {
      if (!grouped[f.category]) grouped[f.category] = [];
      grouped[f.category].push(f);
    });
    return grouped;
  }, [allFeatures]);

  const categories = useMemo(() => {
    return Object.keys(featuresByCategory).sort((a, b) => {
      const aMin = Math.min(...featuresByCategory[a].map((f) => f.sort_order));
      const bMin = Math.min(...featuresByCategory[b].map((f) => f.sort_order));
      return aMin - bMin;
    });
  }, [featuresByCategory]);

  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    tierName: string;
    tierId: string;
    amountPaise: number;
    billingCycle: "monthly" | "yearly";
    paymentType: "subscription" | "boost";
  }>({ open: false, tierName: "", tierId: "", amountPaise: 0, billingCycle: "monthly", paymentType: "subscription" });

  const handleUpgrade = (tierId: string, tierName: string, amountPaise: number, type: "subscription" | "boost" = "subscription") => {
    if (amountPaise <= 0) {
      toast.info("This is a free plan — no payment needed.");
      return;
    }
    setPaymentModal({ open: true, tierId, tierName, amountPaise, billingCycle: "monthly", paymentType: type });
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto px-4 pt-6 pb-28 space-y-4">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-96 rounded-xl" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  const sortedTiers = [...allTiers].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="max-w-4xl mx-auto px-4 pt-6 pb-28 space-y-8"
      >
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-foreground">
            {gateFeature ? `Unlock ${gateFeature.replace(/_/g, " ")}` : "Find the right fit"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {gateFeature
              ? "Upgrade to access this feature and more."
              : "Start free, upgrade when you're ready for better matches and deeper connections."}
          </p>
        </div>

        {/* Tier Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {sortedTiers.map((t) => {
            const isCurrent = t.id === tier;
            const isPopular = t.id === "plus";
            const priceRupees = t.price_monthly / 100;
            const yearlyRupees = t.price_yearly / 100;
            const monthlyCostIfYearly = yearlyRupees / 12;
            const savingsPercent = priceRupees > 0 ? Math.round((1 - monthlyCostIfYearly / priceRupees) * 100) : 0;
            const tierLimits = allLimits.filter((l) => l.tier_id === t.id);

            return (
              <Card
                key={t.id}
                className={`relative overflow-hidden border-t-4 ${BORDER_COLORS[t.badge_color] || "border-t-border"} ${isPopular ? "ring-2 ring-purple-500/30" : ""}`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-bl-lg">
                    Most Popular
                  </div>
                )}
                <CardContent className="pt-5 pb-4 space-y-4">
                  <div>
                    <h3 className="font-serif text-lg text-foreground">{t.name}</h3>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    )}
                  </div>

                  <div>
                    {priceRupees === 0 ? (
                      <p className="text-2xl font-bold text-foreground">Free</p>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-foreground">
                          ₹{priceRupees.toLocaleString("en-IN")}
                          <span className="text-sm font-normal text-muted-foreground">/month</span>
                        </p>
                        {savingsPercent > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ₹{yearlyRupees.toLocaleString("en-IN")}/year (save {savingsPercent}%)
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Limits */}
                  {tierLimits.length > 0 && (
                    <div className="space-y-1">
                      {tierLimits.map((l) => (
                        <p key={l.limit_key} className="text-xs text-muted-foreground">
                          {l.limit_value === -1 ? "Unlimited" : l.limit_value} {l.label?.toLowerCase().replace(/^.*?per /, "/") || l.limit_key.replace(/_/g, " ")}
                        </p>
                      ))}
                    </div>
                  )}

                  <Separator />

                  {/* Features by category */}
                  <div className="space-y-3">
                    {categories.map((cat) => {
                      const features = featuresByCategory[cat];
                      const hasAny = features.some((f) => {
                        const minTier = sortedTiers.find((st) => st.id === f.min_tier_id);
                        return minTier && t.sort_order >= minTier.sort_order;
                      });
                      if (!hasAny && t.sort_order === 0) return null; // Skip empty categories for free tier
                      
                      return (
                        <div key={cat}>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            {CATEGORY_LABELS[cat] || cat}
                          </p>
                          {features.map((f) => {
                            const minTier = sortedTiers.find((st) => st.id === f.min_tier_id);
                            const available = minTier && t.sort_order >= minTier.sort_order;
                            return (
                              <div key={f.feature_key} className="flex items-center gap-1.5 py-0.5">
                                {available ? (
                                  <Check className="w-3 h-3 text-primary shrink-0" />
                                ) : (
                                  <Minus className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                                )}
                                <span className={`text-[11px] ${available ? "text-foreground" : "text-muted-foreground/50"}`}>
                                  {f.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  {/* CTA */}
                  <div className="pt-2">
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : t.sort_order > (sortedTiers.find((st) => st.id === tier)?.sort_order ?? 0) ? (
                      <>
                        <Button className="w-full" onClick={() => handleUpgrade(t.id, t.name, t.price_monthly)}>
                          Get {t.name}
                        </Button>
                        <p className="text-[10px] text-muted-foreground text-center mt-1.5">Cancel anytime</p>
                      </>
                    ) : (
                      <Button variant="ghost" className="w-full text-muted-foreground" disabled>
                        —
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Session Boost Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-serif text-lg text-foreground">Session Boost</h3>
              <p className="text-sm text-muted-foreground">
                Just need one day? Try a Session Boost for <strong>₹99</strong> — unlock next-tier features for 24 hours.
              </p>
            </div>
            <Button onClick={() => handleUpgrade("plus", "Session Boost", 9900, "boost")} className="shrink-0 gap-2">
              <Zap className="w-4 h-4" /> Get Session Boost
            </Button>
          </div>
        </Card>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif text-xl text-foreground mb-4 text-center">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="cancel">
              <AccordionTrigger className="text-sm">Can I cancel anytime?</AccordionTrigger>
              <AccordionContent>Yes, cancel anytime. You keep access until your billing period ends.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="boost">
              <AccordionTrigger className="text-sm">What's a Session Boost?</AccordionTrigger>
              <AccordionContent>A one-day upgrade to the next tier for ₹99. Perfect for trying premium features.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="data">
              <AccordionTrigger className="text-sm">Do I lose my data if I downgrade?</AccordionTrigger>
              <AccordionContent>Never. Your profile, connections, and history are always yours.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="team">
              <AccordionTrigger className="text-sm">Is there a team plan?</AccordionTrigger>
              <AccordionContent>Max tier includes 3 team seats with Pro-level access.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        {paymentModal.open && (
          <PaymentModal
            open
            onOpenChange={(open) => setPaymentModal((prev) => ({ ...prev, open }))}
            tierName={paymentModal.tierName}
            tierId={paymentModal.tierId}
            amountPaise={paymentModal.amountPaise}
            billingCycle={paymentModal.billingCycle}
            paymentType={paymentModal.paymentType}
          />
        )}
      </motion.div>
    </AppShell>
  );
}
