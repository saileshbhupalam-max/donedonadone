import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Flame, Sparkles, Trophy } from "lucide-react";

interface StreakData {
  current_streak: number;
  longest_streak: number;
  weekly_checkins: number;
  weekly_goal: number;
}

export function StreakCard() {
  const { user } = useAuth();
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_streaks")
      .select("current_streak, longest_streak, weekly_checkins, weekly_goal")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row) setData(row as StreakData);
        setLoading(false);
      });
  }, [user]);

  if (loading) return null;

  const streak = data?.current_streak ?? 0;
  const longest = data?.longest_streak ?? 0;
  const weeklyCheckins = data?.weekly_checkins ?? 0;
  const weeklyGoal = data?.weekly_goal ?? 3;
  const goalMet = weeklyCheckins >= weeklyGoal;
  const progressPct = Math.min((weeklyCheckins / weeklyGoal) * 100, 100);

  return (
    <Card>
      <CardContent className="py-4 px-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className={`w-5 h-5 ${streak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
            {streak > 0 ? (
              <span className="font-semibold text-foreground">
                {streak} day streak
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Check in to start your streak!</span>
            )}
          </div>
          {longest > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Best: {longest}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {weeklyCheckins}/{weeklyGoal} this week
            </span>
            {goalMet && (
              <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                <Sparkles className="w-3 h-3" /> Goal hit!
              </Badge>
            )}
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
