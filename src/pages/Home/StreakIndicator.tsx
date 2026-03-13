import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function StreakIndicator({ userId }: { userId: string }) {
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    supabase
      .from("user_engagement_scores")
      .select("streak_days")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStreakDays(data.streak_days || 0);
      });
  }, [userId]);

  if (streakDays <= 0) return null;

  return (
    <p className="text-xs text-muted-foreground">
      🔥 {streakDays}-day streak{streakDays >= 7 ? " — You're on fire!" : ""}
    </p>
  );
}
