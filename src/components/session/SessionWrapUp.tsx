import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CELEBRATIONS } from "@/lib/personality";
import { motion } from "framer-motion";
import { DayPassConversionCard } from "./DayPassConversionCard";

interface Props {
  eventId: string;
  intention: string;
  intentionSaved: boolean;
  totalMinutes: number;
  groupSize: number;
  onAccomplished: (val: string) => void;
  onPropsClick: () => void;
  onFeedbackClick: () => void;
}

export function SessionWrapUp({
  eventId, intention, intentionSaved, totalMinutes, groupSize,
  onAccomplished, onPropsClick, onFeedbackClick,
}: Props) {
  const { user } = useAuth();
  const [accomplished, setAccomplished] = useState<string | null>(null);
  const [step, setStep] = useState<"intention" | "props" | "feedback" | "done">(
    intentionSaved ? "intention" : "props"
  );

  const handleAccomplished = async (val: string) => {
    if (!user) return;
    setAccomplished(val);
    onAccomplished(val);

    // Update profile streak
    const { data: prof } = await supabase.from("profiles")
      .select("intentions_completed, current_streak")
      .eq("id", user.id).single();

    if (val === "yes") {
      const newCompleted = (prof?.intentions_completed || 0) + 1;
      const newStreak = (prof?.current_streak || 0) + 1;
      await supabase.from("profiles").update({
        intentions_completed: newCompleted,
        current_streak: newStreak,
      }).eq("id", user.id);

      // Check streak milestones
      if ([3, 5, 10, 25].includes(newStreak)) {
        const confetti = (await import("canvas-confetti")).default;
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        const streakMsg = newStreak === 3 ? CELEBRATIONS.streak3 : newStreak === 5 ? CELEBRATIONS.streak5 : newStreak === 10 ? CELEBRATIONS.streak10 : CELEBRATIONS.streak25;
        toast.success(streakMsg);
      } else {
        toast.success(newStreak === 1 ? CELEBRATIONS.firstSession : "Great work! Streak extended");
      }
    } else if (val === "partially") {
      await supabase.from("profiles").update({
        intentions_completed: (prof?.intentions_completed || 0) + 1,
      }).eq("id", user.id);
      toast.success("Progress is progress! 💪");
    } else {
      await supabase.from("profiles").update({ current_streak: 0 }).eq("id", user.id);
      toast("Tomorrow's a fresh start! 🌱");
    }

    setStep("props");
  };

  const hours = Math.round(totalMinutes / 60 * 10) / 10;

  return (
    <div className="space-y-4">
      {/* Group stats */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl mb-1">🎉</p>
            <p className="font-serif text-foreground">
              Your table worked for {hours} hours together!
            </p>
            {groupSize > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                {groupSize} people deep-working side by side
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Intention check */}
      {step === "intention" && intentionSaved && !accomplished && (
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-3">
            <p className="font-serif text-sm text-foreground">Did you get your one thing done?</p>
            <p className="text-xs text-muted-foreground italic">"{intention}"</p>
            <div className="flex gap-2">
              {[
                { val: "yes", label: "Yes ✅", variant: "default" as const },
                { val: "partially", label: "Partially 🔄", variant: "secondary" as const },
                { val: "no", label: "Not yet 💪", variant: "outline" as const },
              ].map(o => (
                <Button key={o.val} size="sm" variant={o.variant} className="flex-1"
                  onClick={() => handleAccomplished(o.val)}>
                  {o.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Props + Feedback buttons */}
      {(step === "props" || step === "feedback" || accomplished) && (
        <div className="space-y-2">
          <Button className="w-full" onClick={onPropsClick}>
            Give Props to your table 🙌
          </Button>
          <Button variant="outline" className="w-full" onClick={onFeedbackClick}>
            Rate this session ⭐
          </Button>
        </div>
      )}

      {/* D2: Day Pass → Member conversion CTA.
         Shows match scores with group members to convert day-pass users.
         Self-gating: DayPassConversionCard checks day_passes table and renders
         nothing for subscription members, so it's safe to always include. */}
      {user && (
        <DayPassConversionCard eventId={eventId} userId={user.id} />
      )}
    </div>
  );
}
