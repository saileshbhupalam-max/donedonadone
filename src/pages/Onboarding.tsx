/* DESIGN: Streamlined 4-step onboarding. Only collects what's needed
   before first session: identity, work+basics, give&get, confirmation.
   Preferences (noise, schedule, location, socials) collected progressively after sessions. */

import { AppShell } from "@/components/layout/AppShell";
import { ERROR_STATES } from "@/lib/personality";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeProfileData } from "@/lib/profileValidation";
import { useNavigate } from "react-router-dom";
import { useState, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { AnimatePresence, motion } from "framer-motion";
import { Step1Identity } from "@/components/onboarding/Step1Identity";
import { Step2WorkVibe } from "@/components/onboarding/Step2WorkVibe";
import { Step3GiveGet } from "@/components/onboarding/Step3GiveGet";
import { Step4Done } from "@/components/onboarding/Step4Done";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ArrowLeft } from "lucide-react";
import { trackAnalyticsEvent } from "@/lib/growth";

import type { OnboardingData } from "@/lib/types";

const TOTAL_STEPS = 4;
const STEP_NAMES = ["About you", "Work style", "Interests", "All set"];
const STEP_CTA: Record<number, string> = {
  1: "Pick your work style \u2192",
  2: "One more thing \u2192",
  3: "See your profile \u2192",
};

export default function Onboarding() {
  usePageTitle("Join — donedonadone");
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Restore saved progress from localStorage
  const savedProgress = (() => {
    try {
      const raw = localStorage.getItem("focusclub_onboarding_progress");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const [step, setStep] = useState(savedProgress?.step || 1);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<OnboardingData>(() => {
    const defaults: OnboardingData = {
      display_name: profile?.display_name || user?.user_metadata?.full_name || "",
      avatar_url: profile?.avatar_url || user?.user_metadata?.avatar_url || null,
      tagline: profile?.tagline || "",
      what_i_do: profile?.what_i_do || "",
      work_vibe: profile?.work_vibe || "",
      gender: profile?.gender || "",
      women_only_interest: profile?.women_only_interest || false,
      noise_preference: profile?.noise_preference || "",
      communication_style: profile?.communication_style || "",
      neighborhood: profile?.neighborhood || "",
      looking_for: profile?.looking_for || [],
      can_offer: profile?.can_offer || [],
      interests: profile?.interests || [],
      linkedin_url: profile?.linkedin_url || "",
      instagram_handle: profile?.instagram_handle || "",
      twitter_handle: profile?.twitter_handle || "",
      phone: profile?.phone || "",
      preferred_latitude: null,
      preferred_longitude: null,
      preferred_radius_km: 5,
      preferred_neighborhoods: [],
      preferred_days: [],
      preferred_times: [],
      preferred_session_duration: 2,
    };
    if (savedProgress?.data) {
      return { ...defaults, ...savedProgress.data };
    }
    return defaults;
  });

  const updateData = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem("focusclub_onboarding_progress", JSON.stringify({ step, data: next }));
      } catch {}
      return next;
    });
  }, [step]);

  const canAdvance = () => {
    switch (step) {
      case 1: return data.display_name.trim().length > 0;
      case 3: return data.looking_for.length > 0;
      default: return true;
    }
  };

  const next = () => {
    if (step < TOTAL_STEPS && canAdvance()) {
      setDirection(1);
      const nextStep = step + 1;
      setStep(nextStep);
      try { localStorage.setItem("focusclub_onboarding_progress", JSON.stringify({ step: nextStep, data })); } catch {}
    }
  };

  const back = () => {
    if (step > 1) {
      setDirection(-1);
      const prevStep = step - 1;
      setStep(prevStep);
      try { localStorage.setItem("focusclub_onboarding_progress", JSON.stringify({ step: prevStep, data })); } catch {}
    }
  };

  const calculateCompletion = () => {
    const fields = [
      data.display_name, data.work_vibe,
      data.gender, data.neighborhood,
    ];
    const arrayFields = [data.looking_for];
    const filled = fields.filter((f) => f && f.trim().length > 0).length;
    const arrayFilled = arrayFields.filter((a) => a.length > 0).length;
    return Math.round(((filled + arrayFilled) / (fields.length + arrayFields.length)) * 100);
  };

  const handleComplete = async (goTo: "events" | "home") => {
    if (!user) return;
    setSaving(true);
    try {
      const completion = calculateCompletion();
      const { error } = await supabase.from("profiles").update(sanitizeProfileData({
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        tagline: data.tagline,
        what_i_do: data.what_i_do,
        work_vibe: data.work_vibe,
        gender: data.gender,
        women_only_interest: data.women_only_interest,
        neighborhood: data.neighborhood,
        looking_for: data.looking_for,
        can_offer: data.can_offer,
        onboarding_completed: true,
        profile_completion: completion,
      })).eq("id", user.id);

      if (error) throw error;

      // Handle referral
      const refCode = localStorage.getItem("fc_ref");
      let refCodeUsed: string | null = null;
      if (refCode) {
        refCodeUsed = refCode;
        localStorage.removeItem("fc_ref");
        const { data: referrer } = await supabase.from("profiles")
          .select("id, display_name")
          .eq("referral_code", refCode)
          .single();
        if (referrer && referrer.id !== user.id) {
          await supabase.from("profiles").update({ referred_by: referrer.id }).eq("id", user.id);
          await supabase.rpc("create_system_notification", {
            p_user_id: referrer.id,
            p_title: `${data.display_name} joined donedonadone through your invite! 🎉`,
            p_body: "Your community is growing!",
            p_type: "referral",
            p_link: `/profile/${user.id}`,
          });
          const { checkAndAwardBadges } = await import("@/lib/badges");
          const { data: referrerProfile } = await supabase.from("profiles").select("*").eq("id", referrer.id).single();
          if (referrerProfile) {
            await checkAndAwardBadges(referrer.id, referrerProfile);
          }
        }
      }

      // Generate referral code
      const referralCode = user.id.replace(/-/g, "").slice(0, 8);
      await supabase.from("profiles").update({ referral_code: referralCode }).eq("id", user.id);

      // Track analytics
      trackAnalyticsEvent('signup', user.id).catch(() => {});
      if (refCodeUsed) {
        trackAnalyticsEvent('referral_signup', user.id, { referral_code: refCodeUsed }).catch(() => {});
      }

      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      localStorage.removeItem("focusclub_onboarding_progress");
      await refreshProfile();
      setTimeout(() => navigate(goTo === "events" ? "/events" : "/home"), 1200);
    } catch (error) {
      console.error("[OnboardingSave]", error);
      toast.error(ERROR_STATES.generic);
    } finally {
      setSaving(false);
    }
  };

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  };

  const stepContent = () => {
    switch (step) {
      case 1: return <Step1Identity data={data} updateData={updateData} userId={user?.id || ""} />;
      case 2: return <Step2WorkVibe data={data} updateData={updateData} />;
      case 3: return <Step3GiveGet data={data} updateData={updateData} />;
      case 4: return <Step4Done data={data} />;
      default: return null;
    }
  };

  return (
    <AppShell hideNav>
      <div className="min-h-screen flex flex-col">
        {/* Progress bar */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
          <Progress value={(step / TOTAL_STEPS) * 100} className="h-1.5 rounded-none [&>div]:bg-primary [&>div]:transition-all [&>div]:duration-500" />
          <div className="flex items-center justify-between px-5 py-3">
            {step > 1 && step < 4 ? (
              <button onClick={back} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}
            <span className="text-xs font-medium text-muted-foreground tracking-wide">
              {STEP_NAMES[step - 1]} &middot; {step}/{TOTAL_STEPS}
            </span>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 flex flex-col px-5 pb-28 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="flex-1"
            >
              {stepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom action */}
        {step < 4 && (
          <div className="fixed bottom-0 left-0 right-0 p-5 bg-background/90 backdrop-blur-sm border-t border-border">
            <Button
              onClick={next}
              disabled={!canAdvance()}
              size="lg"
              className="w-full rounded-full text-base font-medium"
            >
              {STEP_CTA[step] || "Next"}
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="fixed bottom-0 left-0 right-0 p-5 bg-background/90 backdrop-blur-sm border-t border-border space-y-2">
            <Button
              onClick={() => handleComplete("events")}
              disabled={saving}
              size="lg"
              className="w-full rounded-full text-base font-medium"
            >
              {saving ? "Almost there..." : "Find your first session →"}
            </Button>
            <button
              onClick={() => handleComplete("home")}
              disabled={saving}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              I'll explore first
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
