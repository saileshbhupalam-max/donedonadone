import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACHIEVEMENT_DEFS, getAchievementDef } from "@/lib/ranks";
import { format, parseISO } from "date-fns";

interface Props {
  userId: string;
  isOwnProfile?: boolean;
}

interface EarnedAchievement {
  achievement_type: string;
  achieved_at: string;
}

export function AchievementsSection({ userId, isOwnProfile = false }: Props) {
  const [earned, setEarned] = useState<EarnedAchievement[]>([]);
  const [achievementCounts, setAchievementCounts] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("exclusive_achievements")
        .select("achievement_type, achieved_at")
        .eq("user_id", userId);
      setEarned(data || []);

      // Get counts for each achievement type
      const counts: Record<string, number> = {};
      for (const def of ACHIEVEMENT_DEFS) {
        const { count } = await supabase
          .from("exclusive_achievements")
          .select("id", { count: "exact", head: true })
          .eq("achievement_type", def.type);
        counts[def.type] = count || 0;
      }
      setAchievementCounts(counts);
      setLoaded(true);
    })();
  }, [userId]);

  if (!loaded) return null;

  const earnedTypes = new Set(earned.map(a => a.achievement_type));
  const earnedMap = new Map(earned.map(a => [a.achievement_type, a]));

  // On other profiles, only show earned ones
  const defsToShow = isOwnProfile ? ACHIEVEMENT_DEFS : ACHIEVEMENT_DEFS.filter(d => earnedTypes.has(d.type));
  if (defsToShow.length === 0 && !isOwnProfile) return null;

  return (
    <Card>
      <CardContent className="pt-4">
        <h3 className="font-serif text-base text-foreground mb-3">
          {isOwnProfile ? "Achievements" : "Achievements"}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {defsToShow.map(def => {
            const isEarned = earnedTypes.has(def.type);
            const e = earnedMap.get(def.type);
            const count = achievementCounts[def.type] || 0;

            return (
              <Tooltip key={def.type}>
                <TooltipTrigger asChild>
                  <div className={`rounded-xl border p-3 transition-all ${
                    isEarned
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-muted/30 opacity-50"
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xl ${!isEarned ? "grayscale" : ""}`}>
                        {isEarned ? def.emoji : "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {isEarned ? def.name : "???"}
                        </p>
                        {isEarned && e?.achieved_at ? (
                          <p className="text-[10px] text-muted-foreground">
                            {format(parseISO(e.achieved_at), "MMM d, yyyy")}
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground truncate">{def.hint}</p>
                        )}
                      </div>
                    </div>
                    {!isEarned && (
                      <p className="text-[9px] text-muted-foreground mt-1">
                        {def.exclusive
                          ? count === 0 ? "No one has earned this yet — be the first!" : "Already claimed"
                          : `${count} ${count === 1 ? "person has" : "people have"} earned this`
                        }
                      </p>
                    )}
                    {isEarned && def.exclusive && (
                      <p className="text-[9px] text-primary mt-1 font-medium">The ONLY person to earn this</p>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{def.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
