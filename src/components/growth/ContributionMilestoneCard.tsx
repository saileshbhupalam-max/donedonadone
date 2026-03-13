import { useState, useEffect } from "react";
import { Coins, Camera, Star, Upload, Zap, Gift, Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getGrowthConfig } from "@/lib/growthConfig";

interface MilestoneProgress {
  actionsCompleted: number;
  actionsRequired: number;
  premiumDaysEarned: number;
  streakDaysRemaining: number;
  availableActions: Array<{
    type: "photo" | "rating" | "review";
    label: string;
    fc: number;
    icon: "camera" | "star" | "upload";
  }>;
}

async function fetchMilestoneProgress(userId: string): Promise<MilestoneProgress> {
  const config = getGrowthConfig();
  const actionsRequired = config.growth.contributionMilestoneActions;

  // Query venue_contributions for the user in the last 30 days
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: contributions } = await supabase
    .from("venue_contributions")
    .select("id, contribution_type, created_at")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false });

  const actionsCompleted = contributions?.length || 0;

  // Get premium days earned from focus_credits where action = 'contribution_milestone'
  const { data: milestoneCredits } = await supabase
    .from("focus_credits")
    .select("amount")
    .eq("user_id", userId)
    .eq("action", "contribution_milestone");

  const premiumDaysEarned = milestoneCredits?.length || 0;

  // Calculate streak days remaining: 7 days from last contribution
  let streakDaysRemaining = 0;
  if (contributions && contributions.length > 0) {
    const lastContribDate = new Date(contributions[0].created_at!);
    const expiresAt = new Date(lastContribDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const msRemaining = expiresAt.getTime() - Date.now();
    streakDaysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
  }

  // Available actions with rewards from config
  const availableActions: MilestoneProgress["availableActions"] = [
    { type: "photo", label: "Upload a venue photo", fc: config.credits.uploadPhoto, icon: "camera" },
    { type: "rating", label: "Rate noise level", fc: config.credits.rateVenue, icon: "star" },
    { type: "review", label: "Write a mini review", fc: config.credits.writeReview, icon: "upload" },
  ];

  return {
    actionsCompleted,
    actionsRequired,
    premiumDaysEarned,
    streakDaysRemaining,
    availableActions,
  };
}

interface ContributionMilestoneCardProps {
  userId: string;
  onActionSelect?: (type: string) => void;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  camera: Camera,
  star: Star,
  upload: Upload,
};

export function ContributionMilestoneCard({ userId, onActionSelect }: ContributionMilestoneCardProps) {
  const [celebrated, setCelebrated] = useState(false);
  const [data, setData] = useState<MilestoneProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeklyPremiumEarners, setWeeklyPremiumEarners] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMilestoneProgress(userId).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });

    // Fetch real weekly premium earners count
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("focus_credits")
      .select("user_id")
      .eq("action", "contribution_milestone")
      .gte("created_at", weekAgo)
      .then(({ data: earners }) => {
        if (!cancelled && earners) {
          setWeeklyPremiumEarners(new Set(earners.map((e: any) => e.user_id)).size);
        }
      });

    return () => { cancelled = true; };
  }, [userId]);

  if (loading || !data) {
    return (
      <Card className="border border-amber-200 dark:border-amber-800/50 overflow-hidden">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Endowed progress: start at 20%, map real progress across remaining 80%
  const rawProgress = (data.actionsCompleted / data.actionsRequired) * 100;
  const endowedProgress = 20 + rawProgress * 0.8;
  const isComplete = data.actionsCompleted >= data.actionsRequired;
  const remaining = data.actionsRequired - data.actionsCompleted;

  if (isComplete && !celebrated) {
    setCelebrated(true);
  }

  // SVG progress ring
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (endowedProgress / 100) * circumference;

  return (
    <Card className={cn(
      "border overflow-hidden",
      isComplete
        ? "border-green-300 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/15 dark:to-emerald-900/15"
        : "border-amber-200 dark:border-amber-800/50"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-serif flex items-center gap-2">
          {isComplete ? (
            <>
              <Gift className="w-5 h-5 text-green-500" />
              Premium activated for {data.premiumDaysEarned || 1} day{data.premiumDaysEarned !== 1 ? "s" : ""}!
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 text-amber-500" />
              {remaining === 1
                ? "Complete 1 more action to earn Premium!"
                : `Complete ${remaining} more actions for Premium`}
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isComplete ? (
          <div className="text-center py-4 space-y-2">
            <div className="text-4xl">*</div>
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">
              You've unlocked {data.premiumDaysEarned || 1} day{data.premiumDaysEarned !== 1 ? "s" : ""} of Premium through contributions!
            </p>
            <p className="text-xs text-muted-foreground">Keep contributing for more Premium days</p>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            {/* Progress ring */}
            <div className="relative shrink-0">
              <svg width="88" height="88" className="-rotate-90">
                <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth="6"
                  className="text-muted/30" />
                <circle cx="44" cy="44" r={radius} fill="none" strokeWidth="6"
                  strokeDasharray={circumference} strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="text-amber-400 transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold">{data.actionsCompleted}/{data.actionsRequired}</span>
                <span className="text-[9px] text-muted-foreground">actions</span>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex-1 space-y-2">
              {/* Loss aversion: streak warning */}
              {data.streakDaysRemaining <= 3 && data.streakDaysRemaining > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-900/20 rounded px-2 py-1">
                  <Clock className="w-3 h-3" />
                  Your streak expires in {data.streakDaysRemaining} day{data.streakDaysRemaining !== 1 ? "s" : ""}!
                </div>
              )}

              {data.availableActions.map((action) => {
                const Icon = ACTION_ICONS[action.icon] || Star;
                return (
                  <button
                    key={action.type}
                    onClick={() => onActionSelect?.(action.type)}
                    className="w-full flex items-center gap-2 p-2 rounded-md border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs flex-1">{action.label}</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">+{action.fc} FC</span>
                  </button>
                );
              })}

              {/* Social proof */}
              {weeklyPremiumEarners !== null && weeklyPremiumEarners >= 3 && (
                <p className="text-[10px] text-muted-foreground">
                  {weeklyPremiumEarners} members earned Premium this week through contributions
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
