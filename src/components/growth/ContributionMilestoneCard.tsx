import { useState } from "react";
import { Coins, Camera, Star, Upload, Zap, Gift, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// TODO: wire to engine
function getMilestoneProgress(_userId: string) {
  return {
    actionsCompleted: 2,
    actionsRequired: 3,
    premiumDaysEarned: 0,
    streakDaysRemaining: 2,
    availableActions: [
      { type: "photo" as const, label: "Upload a venue photo", fc: 5, icon: "camera" as const },
      { type: "rating" as const, label: "Rate noise level", fc: 5, icon: "star" as const },
      { type: "review" as const, label: "Write a mini review", fc: 10, icon: "upload" as const },
    ],
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
  const data = getMilestoneProgress(userId);

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
              Premium activated for 1 day!
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
              You've unlocked 1 day of Premium through contributions!
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
              <p className="text-[10px] text-muted-foreground">
                12 members earned Premium this week through contributions
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
