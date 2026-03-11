import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackConversion } from "@/lib/trackConversion";

export function UpgradeSessionPrompt() {
  const { profile } = useAuth();
  const { tier } = useSubscription();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("upgrade_prompt_session3_dismissed") === "true");

  if (tier !== "free" || dismissed || !profile || (profile.events_attended || 0) < 3) return null;

  const handleDismiss = () => {
    localStorage.setItem("upgrade_prompt_session3_dismissed", "true");
    setDismissed(true);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-purple-500/5">
      <CardContent className="p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-foreground">
            You've completed 3 sessions! 🎉
          </p>
          <p className="text-xs text-muted-foreground">
            Unlock full profiles and match insights with Plus.
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="text-xs" onClick={() => { trackConversion("clicked_upgrade", { from: "session_prompt" }); navigate("/pricing"); }}>See Plans</Button>
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={handleDismiss}>Maybe later</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
