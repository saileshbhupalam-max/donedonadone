/**
 * @module MatchNudgeCard
 * @description Proactive match nudge cards for the Home feed.
 * Replaces the passive "Top Matches" section with active, contextual recommendations.
 * Each card shows avatar, match score badge (color-coded), compelling reason, and action buttons.
 * Nudges are dismissable (persisted in localStorage).
 *
 * Dependencies: matchNudges.ts (generation), growth.ts (analytics), shadcn/ui, lucide-react
 * Related: Home/index.tsx (consumer), matchUtils.ts (scoring)
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  UserPlus,
  MapPin,
  ArrowRight,
  X,
  Calendar,
  Lightbulb,
  ArrowLeftRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import {
  generateMatchNudges,
  dismissNudge,
  MatchNudge,
  NudgeType,
} from "@/lib/matchNudges";
import { trackAnalyticsEvent } from "@/lib/growth";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Profile = Tables<"profiles">;

interface MatchNudgeCardProps {
  userId: string;
  userProfile: Profile;
  allProfiles: Profile[];
  loading?: boolean;
}

// --- Visual config per nudge type ---

const NUDGE_CONFIG: Record<
  NudgeType,
  {
    icon: React.ElementType;
    accent: string; // Tailwind border/text color
    bgAccent: string; // Subtle background tint
    label: string;
  }
> = {
  new_member: {
    icon: Sparkles,
    accent: "text-amber-500 border-amber-300 dark:border-amber-600",
    bgAccent: "bg-amber-50 dark:bg-amber-950/30",
    label: "New member",
  },
  session_buddy: {
    icon: Calendar,
    accent: "text-blue-500 border-blue-300 dark:border-blue-600",
    bgAccent: "bg-blue-50 dark:bg-blue-950/30",
    label: "Session buddy",
  },
  skill_swap: {
    icon: ArrowLeftRight,
    accent: "text-purple-500 border-purple-300 dark:border-purple-600",
    bgAccent: "bg-purple-50 dark:bg-purple-950/30",
    label: "Skill swap",
  },
  neighbor: {
    icon: MapPin,
    accent: "text-green-500 border-green-300 dark:border-green-600",
    bgAccent: "bg-green-50 dark:bg-green-950/30",
    label: "Neighbor",
  },
  interest_twin: {
    icon: Lightbulb,
    accent: "text-pink-500 border-pink-300 dark:border-pink-600",
    bgAccent: "bg-pink-50 dark:bg-pink-950/30",
    label: "Interest twin",
  },
};

function getScoreBadgeClass(score: number): string {
  if (score > 70) return "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700";
  if (score > 50) return "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700";
  return "bg-muted text-muted-foreground border-border";
}

function SingleNudge({
  nudge,
  userId,
  onDismiss,
}: {
  nudge: MatchNudge;
  userId: string;
  onDismiss: (id: string) => void;
}) {
  const navigate = useNavigate();
  const config = NUDGE_CONFIG[nudge.type];
  const Icon = config.icon;

  const handleViewProfile = () => {
    trackAnalyticsEvent("nudge_acted", userId, {
      nudgeType: nudge.type,
      matchedUserId: nudge.profile.id,
      action: "view_profile",
    });
    navigate(nudge.actionLink);
  };

  const handleConnect = async () => {
    if (nudge.actionLabel === "Already Connected") {
      navigate(nudge.actionLink);
      return;
    }
    trackAnalyticsEvent("nudge_acted", userId, {
      nudgeType: nudge.type,
      matchedUserId: nudge.profile.id,
      action: "connect",
    });
    try {
      const { error } = await supabase.from("connection_requests").insert({
        from_user: userId,
        to_user: nudge.profile.id,
      });
      if (error) {
        if (error.code === "23505") {
          toast.info("Connection request already sent!");
        } else {
          throw error;
        }
      } else {
        toast.success(`Connection request sent to ${nudge.profile.displayName}!`);
      }
    } catch {
      toast.error("Could not send request. Try again later.");
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissNudge(nudge.id);
    trackAnalyticsEvent("nudge_dismissed", userId, {
      nudgeType: nudge.type,
      matchedUserId: nudge.profile.id,
    });
    onDismiss(nudge.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="relative"
    >
      <div
        className={`rounded-lg border p-3 ${config.bgAccent} transition-shadow hover:shadow-sm`}
      >
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Dismiss nudge"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Type label */}
        <div className="flex items-center gap-1.5 mb-2">
          <Icon className={`w-3.5 h-3.5 ${config.accent.split(" ")[0]}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${config.accent.split(" ")[0]}`}>
            {config.label}
          </span>
        </div>

        {/* Profile row */}
        <div className="flex items-start gap-3">
          <Avatar className="w-10 h-10 shrink-0 cursor-pointer" onClick={handleViewProfile}>
            <AvatarImage src={nudge.profile.avatarUrl || ""} />
            <AvatarFallback className="text-xs bg-muted">
              {getInitials(nudge.profile.displayName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-foreground truncate">
                {nudge.profile.displayName}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 shrink-0 ${getScoreBadgeClass(nudge.matchScore)}`}
              >
                {nudge.matchScore}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {nudge.headline}
            </p>
            <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mb-3">
              {nudge.reason}
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-3"
                onClick={handleViewProfile}
              >
                View Profile
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
              <Button
                variant={nudge.actionLabel === "Already Connected" ? "ghost" : "default"}
                size="sm"
                className="h-7 text-xs px-3"
                onClick={handleConnect}
                disabled={nudge.actionLabel === "Already Connected"}
              >
                <UserPlus className="w-3 h-3 mr-1" />
                {nudge.actionLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function MatchNudgeCard({ userId, userProfile, allProfiles, loading }: MatchNudgeCardProps) {
  const [nudges, setNudges] = useState<MatchNudge[]>([]);
  const [generating, setGenerating] = useState(true);
  const navigate = useNavigate();

  const generate = useCallback(async () => {
    if (!userId || !userProfile || allProfiles.length === 0) {
      setGenerating(false);
      return;
    }
    setGenerating(true);
    try {
      const result = await generateMatchNudges(userId, userProfile, allProfiles, 3);
      setNudges(result);
    } catch (err) {
      console.debug("[MatchNudges] generation error:", err);
    } finally {
      setGenerating(false);
    }
  }, [userId, userProfile, allProfiles]);

  useEffect(() => {
    if (!loading) {
      generate();
    }
  }, [loading, generate]);

  const handleDismiss = (nudgeId: string) => {
    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
  };

  // Loading state
  if (loading || generating) {
    return <Skeleton className="h-36 rounded-lg" />;
  }

  // No nudges
  if (nudges.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs font-medium text-muted-foreground">People you should meet</p>
          </div>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => navigate("/discover")}
          >
            Discover all
          </button>
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {nudges.map((nudge) => (
              <SingleNudge
                key={nudge.id}
                nudge={nudge}
                userId={userId}
                onDismiss={handleDismiss}
              />
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
