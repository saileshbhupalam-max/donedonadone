/**
 * @module NeighborhoodActivationCard
 * @description The core viral mechanic for pre-unlock neighborhoods. Shows users how
 * close their neighborhood is to unlocking coworking sessions, and motivates them to
 * invite friends. This is the primary growth driver for new neighborhoods.
 *
 * WHY this card exists: DanaDone requires 10 members in a neighborhood before sessions
 * can be created. Users in pre-unlock neighborhoods need (1) visible progress so they
 * feel momentum, (2) contextual copy that matches urgency to proximity, and (3)
 * frictionless sharing to recruit neighbors. The endowed progress effect (Nunes & Dreze)
 * ensures the bar never shows 0% — that kills motivation. Contextual messages shift
 * from "pioneer pride" (early) to "FOMO urgency" (close to unlock).
 *
 * Key exports: NeighborhoodActivationCard
 * Dependencies: locationUtils (activation status), neighborhoods (display names),
 *   growthConfig (thresholds + FC amounts), AuthContext (user profile), supabase (member avatars)
 * Tables read: profiles (member count + avatars via locationUtils + direct query)
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getNeighborhoodActivationStatus, type NeighborhoodActivationStatus } from "@/lib/locationUtils";
import { displayNeighborhood } from "@/lib/neighborhoods";
import { getGrowthConfig } from "@/lib/growthConfig";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, Share2, Sparkles, Trophy } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

// ─── Types ──────────────────────────────────────────────

interface PioneerMember {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

// ─── Progress Messages ──────────────────────────────────
// WHY contextual copy: Generic "X/10 members" is informative but not motivating.
// Research on goal gradient effect (Kivetz et al., 2006) shows that people
// accelerate effort as they approach a goal. The copy matches this psychology:
// early = identity appeal ("be a pioneer"), middle = social proof ("growing fast"),
// late = urgency ("almost there!"), threshold = pure FOMO ("SO CLOSE").

function getProgressMessage(percent: number, remaining: number, areaName: string): string {
  if (percent >= 100) {
    return `DoneDanaDone! ${areaName} is unlocked!`;
  }
  if (percent >= 90) {
    return remaining === 1
      ? "SO CLOSE! One more person unlocks sessions!"
      : `SO CLOSE! Just ${remaining} more to go!`;
  }
  if (percent >= 70) {
    return `Almost there! Just ${remaining} more to go!`;
  }
  if (percent >= 30) {
    return `Growing fast! ${remaining} more people to unlock coworking in ${areaName}`;
  }
  return `Be a pioneer! Invite coworkers in ${areaName} to unlock sessions`;
}

// WHY gradient colors shift with progress: Visual reinforcement of the goal gradient.
// Cool colors (indigo) for early stages feel calm and aspirational. Warm colors (amber,
// green) for later stages create urgency and excitement. The shift is subtle but the
// brain registers "things are heating up" subconsciously.
function getProgressColor(percent: number): string {
  if (percent >= 90) return "bg-green-500";
  if (percent >= 70) return "bg-amber-500";
  if (percent >= 30) return "bg-blue-500";
  return "bg-indigo-500";
}

function getProgressBorderColor(percent: number): string {
  if (percent >= 90) return "border-green-500/20 bg-green-50/30 dark:bg-green-950/10";
  if (percent >= 70) return "border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/10";
  if (percent >= 30) return "border-blue-500/20 bg-blue-50/30 dark:bg-blue-950/10";
  return "border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/10";
}

// ─── Component ──────────────────────────────────────────

export function NeighborhoodActivationCard() {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<NeighborhoodActivationStatus | null>(null);
  const [pioneers, setPioneers] = useState<PioneerMember[]>([]);
  const [loading, setLoading] = useState(true);

  const config = getGrowthConfig();
  const threshold = config.growth.neighborhoodLaunchThreshold;
  const pioneerBonusFC = config.activation.pioneerBonus;

  useEffect(() => {
    if (!user || !profile?.neighborhood) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      // WHY parallel fetches: Activation status (count query) and pioneer avatars
      // (select query) are independent. Running them in parallel saves ~200ms on
      // typical Supabase latency, keeping the card feeling instant.
      const [activationResult, pioneersResult] = await Promise.all([
        getNeighborhoodActivationStatus(profile.neighborhood!, threshold),
        supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .eq("neighborhood", profile.neighborhood!)
          .eq("onboarding_completed", true)
          .order("created_at", { ascending: true })
          .limit(5),
      ]);

      setStatus(activationResult);
      setPioneers((pioneersResult.data as PioneerMember[]) || []);
      setLoading(false);
    };

    fetchData();
  }, [user?.id, profile?.neighborhood, threshold]);

  // ─── Share Handler ──────────────────────────────────
  // WHY 3-tier sharing: Web Share API works natively on mobile (Android + iOS Safari),
  // giving OS-level share sheet with WhatsApp, Telegram, etc. WhatsApp deep link is
  // the fallback because 95%+ of our Bangalore target audience uses WhatsApp daily.
  // Clipboard copy is the last resort for desktop browsers without Web Share API.
  const handleShare = useCallback(async () => {
    if (!status || !profile?.neighborhood) return;

    const areaName = displayNeighborhood(profile.neighborhood);
    const remaining = status.membersNeeded;
    const refParam = profile.referral_code ? `?ref=${profile.referral_code}` : "";
    const joinLink = `${window.location.origin}/invite/${profile.referral_code || ""}${refParam}`;

    const shareText = [
      `Hey! I'm part of a coworking community called DanaDone. We need ${remaining} more people in ${areaName} to unlock group coworking sessions at local cafes.`,
      "",
      `Join free and help us unlock: ${joinLink}`,
      "",
      "When we hit 10 members, we'll match you with 3-5 people to work alongside at great cafes.",
    ].join("\n");

    // Tier 1: Web Share API (mobile-native)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Unlock coworking in ${areaName}`,
          text: shareText,
        });
        toast.success("Thanks for spreading the word!");
        return;
      } catch {
        // User cancelled or API failed — fall through to WhatsApp
      }
    }

    // Tier 2: WhatsApp deep link
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    const opened = window.open(waUrl, "_blank");
    if (opened) {
      toast.success("Opening WhatsApp...");
      return;
    }

    // Tier 3: Clipboard copy
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Invite message copied! Paste it in your favorite chat.");
    } catch {
      toast.error("Could not copy. Please share manually.");
    }
  }, [status, profile?.neighborhood, profile?.referral_code]);

  // ─── Render Guards ──────────────────────────────────
  // WHY return null on loading: Skeleton shimmer for a card that may not render at all
  // (already unlocked) creates visual noise. Better to show nothing until we know.
  if (loading) return null;
  if (!status || !profile?.neighborhood) return null;

  // WHY return null when unlocked: The existing NeighborhoodUnlock component
  // handles the post-unlock celebration + nomination CTA. This card is only
  // for the pre-unlock progress + invitation journey.
  if (status.isUnlocked) return null;

  const areaName = displayNeighborhood(profile.neighborhood);
  const percent = status.progressPercent;
  // WHY endowed progress (minimum 15%): Nunes & Dreze's car wash study showed that
  // a loyalty card pre-stamped with 2/12 stamps had 34% higher completion than
  // an empty 0/10 card — even though both require 10 actions. A bar that starts
  // at 15% tells the user "you've already begun" and prevents the "why bother?" feeling.
  const displayPercent = Math.max(percent, 15);
  const progressColor = getProgressColor(percent);
  const borderColor = getProgressBorderColor(percent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card className={`overflow-hidden ${borderColor}`}>
        <CardContent className="p-4 space-y-3">
          {/* Header: area name + member count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                {percent >= 90 ? (
                  <Trophy className="w-4 h-4 text-amber-500" />
                ) : (
                  <Users className="w-4 h-4 text-primary" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground leading-tight">
                  Unlock {areaName}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {status.memberCount}/{status.threshold} members joined
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-foreground tabular-nums">
              {percent}%
            </span>
          </div>

          {/* Animated progress bar */}
          {/* WHY custom indicator class: The shadcn Progress component uses translateX
              for its indicator, which supports CSS transitions natively. We override the
              indicator color via a CSS class on the root to shift hue with progress. */}
          <div className="relative">
            <Progress
              value={displayPercent}
              className="h-2.5 bg-muted/50"
              /* The indicator inherits bg-primary; override via the [&>div] selector */
              style={{ ["--progress-color" as string]: "currentColor" }}
            />
            {/* Overlay the progress bar indicator with the contextual color */}
            <div
              className={`absolute inset-0 h-2.5 rounded-full overflow-hidden pointer-events-none`}
            >
              <div
                className={`h-full ${progressColor} transition-all duration-700 ease-out rounded-full`}
                style={{ width: `${displayPercent}%` }}
              />
            </div>
          </div>

          {/* Contextual progress message */}
          <p className="text-xs text-foreground/80 leading-relaxed">
            {getProgressMessage(percent, status.membersNeeded, areaName)}
          </p>

          {/* Pioneer member avatars */}
          {pioneers.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {pioneers.slice(0, 5).map((member) => (
                  <Avatar
                    key={member.id}
                    className="w-7 h-7 border-2 border-background"
                  >
                    <AvatarImage src={member.avatar_url || ""} />
                    <AvatarFallback className="text-[9px] bg-muted">
                      {getInitials(member.display_name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {status.memberCount > 5 && (
                <span className="text-[10px] text-muted-foreground">
                  +{status.memberCount - 5} more
                </span>
              )}
            </div>
          )}

          {/* Share CTA button */}
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={handleShare}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleShare();
              }
            }}
          >
            <Share2 className="w-3.5 h-3.5" />
            Invite friends to unlock
          </Button>

          {/* Pioneer reward preview */}
          {/* WHY show the FC reward: Loss aversion + endowed progress. Users who see
              "you'll earn 20 FC" feel they already own those credits and will work
              harder to avoid "losing" them by not inviting. Small text keeps it as a
              bonus nudge rather than the primary motivator (intrinsic > extrinsic). */}
          <div className="flex items-center justify-center gap-1.5 pt-0.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <p className="text-[10px] text-muted-foreground">
              Pioneer members earn {pioneerBonusFC} FC when this area unlocks
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
