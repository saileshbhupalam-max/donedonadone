import { useState, useCallback } from "react";
import { Zap, Users, MapPin, X, Share2, Camera, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// TODO: wire to engine
function getActiveNudge(_userId: string): NudgeData | null {
  return {
    type: "post-good-session",
    headline: "Great session! Know someone who'd love FocusClub?",
    body: "They get their first session free, and you earn 20 FC.",
    action: { label: "Invite a friend", type: "share" as const },
    socialProof: "47 members invited friends this week",
  };
}
function dismissNudge(_userId: string, _type: string): void { /* cooldown tracked */ }

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

export function GrowthNudgeCard({ userId, onAction }: GrowthNudgeCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const nudge = getActiveNudge(userId);

  const handleDismiss = useCallback(() => {
    if (nudge) dismissNudge(userId, nudge.type);
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
