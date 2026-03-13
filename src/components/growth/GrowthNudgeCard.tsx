import { useState, useCallback } from "react";
import { Zap, Users, MapPin, X, Share2, Camera, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shouldShowReferralNudge, trackNudgeDismissal, type NudgeType, type NudgeConfig } from "@/lib/aiGrowthNudges";

const NUDGE_TYPE_MAP: Record<NudgeType, { type: NudgeData["type"]; actionType: NudgeData["action"]["type"] }> = {
  referral_post_session: { type: "post-good-session", actionType: "share" },
  referral_milestone: { type: "milestone", actionType: "share" },
  referral_no_slots: { type: "no-slots", actionType: "invite" },
  referral_onboarding: { type: "post-good-session", actionType: "share" },
  neighborhood_launch: { type: "neighborhood", actionType: "invite" },
  contribution_prompt: { type: "post-good-session", actionType: "contribute" },
  streak_reminder: { type: "post-good-session", actionType: "share" },
};

function getActiveNudge(userId: string, sessionCount?: number, neighborhood?: string): NudgeData | null {
  const result: NudgeConfig | null = shouldShowReferralNudge(userId, {
    sessionCount,
    neighborhood,
  });
  if (!result) return null;

  const mapping = NUDGE_TYPE_MAP[result.type];
  return {
    type: mapping.type,
    headline: result.message,
    body: result.message,
    action: { label: result.cta, type: mapping.actionType },
  };
}

interface NudgeData {
  type: "post-good-session" | "milestone" | "no-slots" | "neighborhood";
  headline: string;
  body: string;
  action: { label: string; type: "share" | "invite" | "contribute" };
  socialProof?: string;
  lossAversion?: string;
}

interface GrowthNudgeCardProps {
  userId: string;
  sessionCount?: number;
  neighborhood?: string;
  onAction?: (type: string) => void;
}

const NUDGE_ICONS: Record<string, React.ElementType> = {
  "post-good-session": Gift,
  milestone: Zap,
  "no-slots": MapPin,
  neighborhood: Users,
};

const NUDGE_COLORS: Record<string, string> = {
  "post-good-session": "from-amber-50 to-orange-50 dark:from-amber-900/15 dark:to-orange-900/15 border-amber-200 dark:border-amber-800",
  milestone: "from-purple-50 to-indigo-50 dark:from-purple-900/15 dark:to-indigo-900/15 border-purple-200 dark:border-purple-800",
  "no-slots": "from-blue-50 to-cyan-50 dark:from-blue-900/15 dark:to-cyan-900/15 border-blue-200 dark:border-blue-800",
  neighborhood: "from-green-50 to-emerald-50 dark:from-green-900/15 dark:to-emerald-900/15 border-green-200 dark:border-green-800",
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  share: Share2,
  invite: Users,
  contribute: Camera,
};

export function GrowthNudgeCard({ userId, sessionCount, neighborhood, onAction }: GrowthNudgeCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const nudge = getActiveNudge(userId, sessionCount, neighborhood);

  const handleDismiss = useCallback(() => {
    if (nudge) {
      // Reverse-lookup the engine NudgeType from the component's display type
      const engineType = Object.entries(NUDGE_TYPE_MAP).find(
        ([, v]) => v.type === nudge.type && v.actionType === nudge.action.type
      )?.[0] as NudgeType | undefined;
      if (engineType) trackNudgeDismissal(userId, engineType);
    }
    setDismissed(true);
  }, [userId, nudge]);

  const handleAction = useCallback(() => {
    if (nudge) onAction?.(nudge.action.type);
  }, [nudge, onAction]);

  if (!nudge || dismissed) return null;

  const Icon = NUDGE_ICONS[nudge.type] || Zap;
  const ActionIcon = ACTION_ICONS[nudge.action.type] || Zap;
  const colors = NUDGE_COLORS[nudge.type] || NUDGE_COLORS["post-good-session"];

  return (
    <Card className={cn("border bg-gradient-to-r overflow-hidden", colors)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white/80 dark:bg-white/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-foreground" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-tight">{nudge.headline}</h3>
              <button onClick={handleDismiss} className="shrink-0 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{nudge.body}</p>

            {/* Loss aversion warning */}
            {nudge.lossAversion && (
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                {nudge.lossAversion}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <Button size="sm" onClick={handleAction} className="text-xs h-8">
                <ActionIcon className="w-3 h-3 mr-1.5" />
                {nudge.action.label}
              </Button>
              {/* Social proof */}
              {nudge.socialProof && (
                <p className="text-[10px] text-muted-foreground">{nudge.socialProof}</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
