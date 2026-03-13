import { useState, useCallback, useEffect } from "react";
import { Users, Copy, Check, Gift, Trophy, Medal, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getReferralStats as fetchReferralStats } from "@/lib/referralEngine";
import { supabase } from "@/integrations/supabase/client";

interface ReferralDashboardProps {
  userId: string;
}

const MILESTONES = [
  { count: 5, label: "Explorer Badge", icon: Medal },
  { count: 10, label: "Community Builder", icon: Trophy },
  { count: 25, label: "Growth Champion", icon: Gift },
];

export function ReferralDashboard({ userId }: ReferralDashboardProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    referralCode: "",
    referralLink: "",
    invited: 0,
    firstSession: 0,
    threeOrMore: 0,
    totalFCEarned: 0,
    hasCommunityBuilder: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [engineStats, profileResult] = await Promise.all([
          fetchReferralStats(userId),
          supabase
            .from("profiles")
            .select("referral_code")
            .eq("id", userId)
            .single(),
        ]);

        if (cancelled) return;

        const referralCode =
          (profileResult.data as any)?.referral_code || "";
        const referralLink = referralCode
          ? `${window.location.origin}/invite/${referralCode}`
          : "";

        setStats({
          referralCode,
          referralLink,
          invited: engineStats.totalReferred,
          firstSession: engineStats.completedFirstSession,
          threeOrMore: engineStats.completed3Sessions,
          totalFCEarned: engineStats.totalCreditsEarned,
          hasCommunityBuilder: engineStats.completed3Sessions >= 10,
        });
      } catch (err) {
        console.error("Failed to load referral stats", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const nextMilestone = MILESTONES.find((m) => m.count > stats.threeOrMore) || MILESTONES[MILESTONES.length - 1];
  const prevMilestoneCount = MILESTONES.findIndex((m) => m.count === nextMilestone.count) > 0
    ? MILESTONES[MILESTONES.findIndex((m) => m.count === nextMilestone.count) - 1].count
    : 0;
  // Endowed progress: start at 20%
  const rawProgress = ((stats.threeOrMore - prevMilestoneCount) / (nextMilestone.count - prevMilestoneCount)) * 100;
  const endowedProgress = Math.min(100, 20 + rawProgress * 0.8);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(stats.referralLink);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  }, [stats.referralLink]);

  const shareWhatsApp = useCallback(() => {
    const text = `Join me on FocusClub! Work alongside motivated people at great cafes. Your first session is free: ${stats.referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }, [stats.referralLink]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Users className="w-5 h-5" />
            Referrals
          </CardTitle>
          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            {stats.totalFCEarned} FC earned
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
            Loading referral data...
          </div>
        ) : <>
        {/* Community Builder badge */}
        {stats.hasCommunityBuilder && (
          <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
            <Trophy className="w-6 h-6 text-purple-500" />
            <div>
              <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">Community Builder</p>
              <p className="text-xs text-purple-600 dark:text-purple-400">You've helped grow FocusClub!</p>
            </div>
          </div>
        )}

        {/* Referral link */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Your referral link</p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-background rounded px-2 py-1.5 border truncate">
              {stats.referralLink}
            </code>
            <Button size="sm" variant="outline" onClick={copyLink}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={shareWhatsApp}>
            <Share2 className="w-4 h-4 mr-2" />
            Share on WhatsApp
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-2xl font-bold">{stats.invited}</p>
            <p className="text-[10px] text-muted-foreground">Invited</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-2xl font-bold">{stats.firstSession}</p>
            <p className="text-[10px] text-muted-foreground">1st session</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-2xl font-bold">{stats.threeOrMore}</p>
            <p className="text-[10px] text-muted-foreground">3+ sessions</p>
          </div>
        </div>

        {/* Milestone progress with endowed progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1">
              <nextMilestone.icon className="w-4 h-4 text-amber-500" />
              Next: {nextMilestone.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {stats.threeOrMore}/{nextMilestone.count} referrals
            </span>
          </div>
          <Progress value={endowedProgress} className="h-2" />
          <p className="text-[10px] text-muted-foreground">
            {nextMilestone.count - stats.threeOrMore} more referrals who complete 3+ sessions
          </p>
        </div>

        {/* Social proof */}
        <p className="text-xs text-center text-muted-foreground">
          Members who refer friends report 40% better group matches
        </p>
        </>}
      </CardContent>
    </Card>
  );
}
