import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MilestoneDef, MILESTONES } from "@/lib/growth";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppShareButton, LinkedInShareButton } from "@/components/sharing/WhatsAppButton";
import { X, Share2 } from "lucide-react";

interface MilestoneCelebrationProps {
  milestone: MilestoneDef;
  userId: string;
  referralCode?: string | null;
  onDismiss: () => void;
}

export function MilestoneCelebration({ milestone, userId, referralCode, onDismiss }: MilestoneCelebrationProps) {
  const [stats, setStats] = useState({ hours: 0, peopleMet: 0, propsReceived: 0 });
  const firedConfetti = useRef(false);

  useEffect(() => {
    if (!firedConfetti.current) {
      firedConfetti.current = true;
      (async () => {
        const confetti = (await import("canvas-confetti")).default;
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      })();
    }

    (async () => {
      const [{ data: profile }, { count: props }, { count: coworkers }] = await Promise.all([
        supabase.from("profiles").select("focus_hours").eq("id", userId).single(),
        supabase.from("peer_props").select("id", { count: "exact", head: true }).eq("to_user", userId),
        supabase.from("event_rsvps").select("user_id", { count: "exact", head: true })
          .eq("status", "going").neq("user_id", userId),
      ]);
      setStats({
        hours: Math.round(Number(profile?.focus_hours ?? 0)),
        peopleMet: Math.min(coworkers || 0, 999),
        propsReceived: props || 0,
      });
    })();
  }, [userId]);

  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";
  const linkedInUrl = `${APP_URL}/invite/${referralCode || ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-up">
      <Card className="w-full max-w-sm border-primary/30 shadow-lg">
        <CardContent className="p-6 space-y-4 text-center">
          <button onClick={onDismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>

          <div className="text-5xl">{milestone.emoji}</div>
          <h2 className="font-serif text-2xl text-foreground">{milestone.title}</h2>
          <p className="text-sm text-muted-foreground">{milestone.description}</p>

          {/* Stats */}
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            {stats.hours > 0 && <span>{stats.hours}h deep work</span>}
            {stats.peopleMet > 0 && <span>{stats.peopleMet} people met</span>}
            {stats.propsReceived > 0 && <span>{stats.propsReceived} props</span>}
          </div>

          {/* Share options */}
          <div className="flex gap-2 pt-2">
            <WhatsAppShareButton
              message={milestone.shareMessage(referralCode)}
              label="WhatsApp"
              size="sm"
              className="flex-1"
            />
            <LinkedInShareButton
              url={linkedInUrl}
              label="LinkedIn"
              size="sm"
              className="flex-1"
            />
          </div>

          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={onDismiss}>
            Keep going! 💪
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
