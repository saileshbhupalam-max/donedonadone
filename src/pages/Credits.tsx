import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Coins,
  Ticket,
  Star,
  ArrowUpRight,
  Gift,
  Users,
  Armchair,
  Sparkles,
  ArrowDown,
  ArrowUp,
  Loader2,
  Zap,
  Shield,
  Snowflake,
  AlertTriangle,
  Clock,
  Crown,
  MapPin,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  getBalance,
  fulfillRedemption,
  getLifetimeEarnings,
  getUserTier,
  getStreakMultiplier,
  getEffectiveMultiplier,
  purchaseStreakFreeze,
  getExpiringCredits,
  type CreditAction,
  type UserTierInfo,
  type ExpiringCreditsInfo,
} from "@/lib/focusCredits";
import { getGrowthConfig } from "@/lib/growthConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";

interface LedgerEntry {
  id: string;
  amount: number;
  action: string;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  session_complete: "Session completed",
  rate_group: "Rated group",
  rate_venue: "Rated venue",
  write_review: "Wrote review",
  upload_photo: "Uploaded photo",
  report_venue_info: "Venue report",
  referral_complete: "Referral reward",
  referral_milestone_3: "3-referral milestone",
  streak_bonus: "Streak bonus",
  great_groupmate: "Great groupmate bonus",
  add_new_venue: "Added new venue",
  verify_venue_info: "Verified venue info",
  check_in_photo: "Check-in photo",
  report_company_presence: "Reported company",
  report_seating_capacity: "Reported seating",
  report_floor_count: "Reported floors",
  report_amenities: "Reported amenities",
  redeem_free_session: "Free session",
  redeem_priority_matching: "Priority matching",
  redeem_venue_upgrade: "Venue upgrade",
  redeem_pick_seat: "Pick your seat",
  redeem_gift_session: "Gift a session",
  redeem_exclusive_session: "Exclusive session",
  redeem_session_boost: "Session boost",
  // Gamification v2
  welcome_bonus: "Welcome bonus",
  first_session_bonus: "First session bonus",
  mystery_double: "Mystery double!",
  group_chemistry_bonus: "Great group vibes",
  golden_session: "Golden session",
  group_streak_bonus: "Group streak",
  reliability_bonus: "Reliability streak",
  venue_variety_bonus: "Venue explorer",
  streak_freeze_purchase: "Streak freeze",
  streak_milestone: "Streak milestone",
  no_show_penalty: "No-show penalty",
  late_cancel_penalty: "Late cancel penalty",
  // Anti-inflation sinks (v3)
  redeem_profile_highlight: "Profile highlight",
  redeem_venue_choice: "Venue choice",
  redeem_group_size_preference: "Group size pref",
};

interface RedeemOption {
  action: CreditAction;
  label: string;
  description: string;
  cost: number;
  icon: React.ElementType;
  comingSoon?: boolean;
}

export default function Credits() {
  usePageTitle("Focus Credits — DanaDone");
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemTarget, setRedeemTarget] = useState<RedeemOption | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  // WHY: Tier visibility creates an aspiration loop — users see the next tier
  // and work toward it (Starbucks loyalty model: visible tiers = 2.5x engagement).
  const [tierInfo, setTierInfo] = useState<UserTierInfo | null>(null);
  // WHY: Streak display activates loss aversion (Kahneman: losses felt 2.25x).
  // Seeing "6 week streak" makes missing a week feel like destroying progress.
  const [streakWeeks, setStreakWeeks] = useState(0);
  // WHY: Showing the combined multiplier makes every earn feel amplified.
  // "Earning at 1.5x" reframes routine sessions as high-value activities.
  const [effectiveMultiplier, setEffectiveMultiplier] = useState(1.0);
  const [buyingFreeze, setBuyingFreeze] = useState(false);
  // WHY: Visible expiry creates urgency to spend (Starbucks saw 15% higher
  // redemption velocity after showing "stars expiring on [date]"). Users who
  // see a concrete deadline act; users who see a static balance hoard.
  const [expiringInfo, setExpiringInfo] = useState<ExpiringCreditsInfo | null>(null);

  const config = getGrowthConfig().credits;

  // WHY: Color-coded tiers create visible status differentiation — users
  // instantly recognize their rank and what others have achieved (social proof).
  const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    explorer: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", border: "border-gray-300 dark:border-gray-600" },
    regular: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700" },
    insider: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-300 dark:border-purple-700" },
    champion: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700" },
  };

  const redeemOptions: RedeemOption[] = [
    {
      action: "redeem_free_session",
      label: "Free Session",
      description: "Get one session completely free",
      cost: config.freeSession,
      icon: Ticket,
    },
    {
      action: "redeem_priority_matching",
      label: "Priority Matching",
      description: "Get matched with your preferred coworkers first",
      cost: config.priorityMatching,
      icon: Star,
    },
    {
      action: "redeem_exclusive_session",
      label: "Exclusive Session",
      description: "Coming soon",
      cost: config.exclusiveSession,
      icon: Sparkles,
      comingSoon: true,
    },
    {
      action: "redeem_pick_seat",
      label: "Pick Your Seat",
      description: "Coming soon",
      cost: config.pickSeat,
      icon: Armchair,
      comingSoon: true,
    },
    {
      action: "redeem_venue_upgrade",
      label: "Venue Upgrade",
      description: "Coming soon",
      cost: config.venueUpgrade,
      icon: ArrowUpRight,
      comingSoon: true,
    },
    {
      action: "redeem_gift_session",
      label: "Gift a Session",
      description: "Send a free session to a friend",
      cost: config.giftSession,
      icon: Gift,
    },
    {
      action: "redeem_session_boost",
      label: "Session Boost",
      description: "Move up in matching priority for your next session",
      cost: 15,
      icon: Zap,
    },
    // ─── New anti-inflation sinks ───
    // WHY these three: They target the 200-400 FC/month surplus by offering
    // social status (highlight) and preference control (venue, group size) —
    // the two motivators that work in every community platform.
    {
      action: "redeem_profile_highlight",
      label: "Profile Highlight",
      description: "Stand out in group matching for 7 days",
      cost: config.profileHighlight,
      icon: Crown,
    },
    {
      action: "redeem_venue_choice",
      label: "Choose Your Venue",
      description: "Pick your preferred venue for your next session",
      cost: config.venueChoice,
      icon: MapPin,
    },
    {
      action: "redeem_group_size_preference",
      label: "Group Size Pref",
      description: "Request a smaller (3) or larger (5) group",
      cost: config.groupSizePreference,
      icon: UsersRound,
    },
  ];

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [bal, { data: entries }, lifetimeFC, { data: prof }, expiring] = await Promise.all([
      getBalance(user.id),
      supabase
        .from("focus_credits")
        .select("id, amount, action, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      getLifetimeEarnings(user.id),
      supabase
        .from("profiles")
        .select("current_streak")
        .eq("id", user.id)
        .single(),
      // WHY 14 days: Two-week warning window gives users enough time to browse
      // the redemption catalog and decide, without being so early that it feels
      // irrelevant. Starbucks uses a similar ~2 week pre-expiry notification.
      getExpiringCredits(user.id, 14),
    ]);

    setBalance(bal);
    setHistory((entries as LedgerEntry[]) || []);

    // Compute tier from lifetime earnings (never demotes — Starbucks model)
    const tier = getUserTier(lifetimeFC);
    setTierInfo(tier);

    // Streak from profile (updated server-side each week)
    const weeks = (prof as any)?.current_streak || 0;
    setStreakWeeks(weeks);

    // Combined multiplier: tier × streak — both compound independently
    setEffectiveMultiplier(getEffectiveMultiplier(lifetimeFC, weeks));

    // Expiry warning data
    setExpiringInfo(expiring.amount > 0 ? expiring : null);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRedeem = async () => {
    if (!user || !redeemTarget) return;
    setRedeeming(true);

    const result = await fulfillRedemption(user.id, redeemTarget.action, redeemTarget.cost);

    if (result.success) {
      if (redeemTarget.action === "redeem_free_session") {
        toast.success(`Free session activated! Code: ${result.data?.access_code}`);
      } else if (redeemTarget.action === "redeem_gift_session") {
        toast.success(`Gift code: ${result.data?.gift_code} — share with a friend!`);
      } else if (redeemTarget.action === "redeem_priority_matching") {
        toast.success("Priority matching active for 7 days!");
      } else if (redeemTarget.action === "redeem_session_boost") {
        toast.success("Boost active! You'll get priority in your next session.");
      } else if (redeemTarget.action === "redeem_profile_highlight") {
        toast.success("Profile highlighted! You'll stand out in matching for 7 days.");
      } else if (redeemTarget.action === "redeem_venue_choice") {
        toast.success("Venue choice unlocked! Pick your preferred venue for your next session.");
      } else if (redeemTarget.action === "redeem_group_size_preference") {
        toast.success("Group size preference set! We'll try to match your preferred size.");
      } else {
        toast.success(`Redeemed: ${redeemTarget.label}!`);
      }
      setRedeemTarget(null);
      fetchData();
    } else {
      toast.error(
        result.reason === "insufficient_balance"
          ? "Not enough Focus Credits"
          : "Redemption failed"
      );
    }
    setRedeeming(false);
  };

  const handleBuyFreeze = async () => {
    if (!user) return;
    setBuyingFreeze(true);
    const result = await purchaseStreakFreeze(user.id);
    if (!result.success) {
      toast.error(result.error || "Could not purchase streak freeze");
    }
    await fetchData();
    setBuyingFreeze(false);
  };

  const totalEarned = history.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalSpent = history.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-4 space-y-5 max-w-lg mx-auto pb-8"
      >
        {/* Header + Balance */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center mx-auto mb-3">
            <Coins className="w-7 h-7 text-white" />
          </div>
          {loading ? (
            <Skeleton className="h-10 w-24 mx-auto" />
          ) : (
            <p className="text-4xl font-bold text-amber-900 dark:text-amber-200">
              {balance.toLocaleString()}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">Focus Credits</p>

          {!loading && (
            <div className="flex justify-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ArrowUp className="w-3 h-3 text-green-500" />
                {totalEarned} earned
              </span>
              <span className="flex items-center gap-1">
                <ArrowDown className="w-3 h-3 text-red-400" />
                {totalSpent} spent
              </span>
            </div>
          )}
        </div>

        {/* ─── Gamification Dashboard ─────────────────────────
          WHY: Making progression systems visible turns passive earners into
          active optimizers. Starbucks found that tier visibility increased
          spend-to-next-tier behavior by 2.5x. Duolingo found that showing
          streaks on the home screen increased daily opens by 14%.
        */}
        {!loading && tierInfo && (
          <>
            {/* WHY: Combined multiplier shown prominently so every future earn
                feels amplified. "Earning at 1.5x" reframes routine actions as
                high-value — the Peloton "output score" effect. */}
            {effectiveMultiplier > 1.0 && (
              <div className="flex justify-center">
                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 px-3 py-1 text-sm font-semibold shadow-sm">
                  <Zap className="w-3.5 h-3.5 mr-1" />
                  Earning at {effectiveMultiplier.toFixed(1)}x
                </Badge>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* ─── Tier Progress Card ─────────────────────────
                WHY: Visible tier progress creates an "endowed progress" loop
                (Nunes & Dreze). A bar at 60% feels like invested effort you
                can't waste — dramatically increasing next-action motivation.
              */}
              <Card className={`${TIER_COLORS[tierInfo.key].border}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-medium text-muted-foreground">Tier</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${TIER_COLORS[tierInfo.key].text} ${TIER_COLORS[tierInfo.key].border}`}
                    >
                      {tierInfo.label}
                    </Badge>
                  </div>

                  {/* WHY: Progress bar triggers goal-gradient effect — motivation
                      increases as you get closer to the goal (Hull 1932). */}
                  {tierInfo.fcToNextTier !== null ? (
                    <>
                      <Progress
                        value={(() => {
                          const tiers = config.tiers;
                          const tierOrder = [tiers.explorer, tiers.regular, tiers.insider, tiers.champion];
                          const currentMin = tierOrder.find(t => t.label === tierInfo.label)?.minLifetimeFC ?? 0;
                          const nextMin = currentMin + (tierInfo.fcToNextTier ?? 0);
                          const range = nextMin - currentMin;
                          if (range <= 0) return 100;
                          return Math.min(100, ((tierInfo.lifetimeFC - currentMin) / range) * 100);
                        })()}
                        className="h-2 bg-muted"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {tierInfo.fcToNextTier} FC to {tierInfo.nextTierLabel}
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      Max tier reached!
                    </p>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    {tierInfo.earnMultiplier}x earn rate
                  </p>
                </CardContent>
              </Card>

              {/* ─── Streak Card ─────────────────────────
                WHY: Streaks exploit loss aversion (Kahneman: 2.25x). Once a user
                has a 6-week streak, the psychological cost of breaking it far
                exceeds the cost of attending one more session. Duolingo data:
                streak visibility alone increased 7-day retention by 14%.
              */}
              <Card className="border-orange-200 dark:border-orange-800">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm" role="img" aria-label="fire">🔥</span>
                      <span className="text-xs font-medium text-muted-foreground">Streak</span>
                    </div>
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      {streakWeeks}w
                    </span>
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    {getStreakMultiplier(streakWeeks) > 1.0
                      ? `${getStreakMultiplier(streakWeeks).toFixed(1)}x streak bonus`
                      : "Attend weekly to build streak"}
                  </p>

                  {/* WHY: Streak freeze purchase is a "loss aversion monetization"
                      — Duolingo found streak freezes reduced churn 21% among
                      at-risk users. The user pays FC to protect sunk cost. */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-[10px] gap-1"
                    onClick={handleBuyFreeze}
                    disabled={buyingFreeze || balance < config.streak.freezeCost}
                  >
                    {buyingFreeze ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Snowflake className="w-3 h-3" />
                    )}
                    Freeze ({config.streak.freezeCost} FC)
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <Separator />

        {/* ─── FC Expiry Warning Banner ─────────────────────────
          WHY: Visible expiry deadlines increase redemption velocity 15-20%
          (loyalty program industry data). Showing "47 FC expiring in 12 days"
          triggers loss aversion — the user feels they're about to LOSE something
          they earned, which is 2.25x more motivating than gaining the same amount
          (Kahneman/Tversky). Placed directly above Redeem to create an immediate
          call-to-action: "your FC is expiring → here's how to spend it."
        */}
        {!loading && expiringInfo && expiringInfo.amount > 0 && (
          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700">
            <CardContent className="p-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  {expiringInfo.amount} FC expiring soon
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {expiringInfo.earliestExpiry
                    ? `Earliest: ${format(parseISO(expiringInfo.earliestExpiry), "MMM d, yyyy")}`
                    : "Within 14 days"}
                </p>
                <p className="text-[10px] text-amber-600/80 dark:text-amber-500 mt-1">
                  Redeem below before they expire!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Redeem Section */}
        <section>
          <h2 className="font-serif text-lg text-foreground mb-3 flex items-center gap-2">
            <Gift className="w-4 h-4 text-primary" /> Redeem
          </h2>

          {loading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {redeemOptions.map((opt) => {
                const canAfford = balance >= opt.cost;
                const disabled = !canAfford || opt.comingSoon;
                return (
                  <Card
                    key={opt.action}
                    className={`cursor-pointer transition-all ${
                      disabled
                        ? "opacity-50"
                        : "hover:shadow-md hover:border-primary/40"
                    }`}
                    onClick={() => !disabled && setRedeemTarget(opt)}
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <opt.icon className="w-4 h-4 text-primary" />
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                        >
                          {opt.cost} FC
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground leading-tight">
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {opt.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Monthly Statement */}
        {!loading && history.length > 0 && (() => {
          const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
          const thisMonth = history.filter((e) => e.created_at >= monthStart);
          const mEarned = thisMonth.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
          const mSpent = thisMonth.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
          if (mEarned === 0 && mSpent === 0) return null;
          return (
            <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">This Month</p>
                <p className="text-sm text-foreground">
                  You earned <span className="font-semibold text-green-600">{mEarned} FC</span>
                  {mSpent > 0 && <> and spent <span className="font-semibold text-red-500">{mSpent} FC</span></>}
                  {mSpent > 0 ? "." : " so far."}
                </p>
              </CardContent>
            </Card>
          );
        })()}

        <Separator />

        {/* History */}
        <section>
          <h2 className="font-serif text-lg text-foreground mb-3 flex items-center gap-2">
            <Coins className="w-4 h-4 text-primary" /> History
          </h2>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Coins className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No credits yet. Complete a session to start earning!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        entry.amount > 0
                          ? "bg-green-100 dark:bg-green-900/30"
                          : "bg-red-100 dark:bg-red-900/30"
                      }`}
                    >
                      {entry.amount > 0 ? (
                        <ArrowUp className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-red-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {ACTION_LABELS[entry.action] || entry.action}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(parseISO(entry.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold shrink-0 ${
                      entry.amount > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-500 dark:text-red-400"
                    }`}
                  >
                    {entry.amount > 0 ? "+" : ""}
                    {entry.amount} FC
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* How to earn — WHY: Showing multiplied amounts makes the multiplier
            feel tangible. "10 FC (x1.5 = 15 FC)" turns an abstract multiplier
            into a concrete reward increase, reinforcing tier/streak investment. */}
        <section>
          <h2 className="font-serif text-lg text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> How to Earn
          </h2>
          <Card>
            <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
              {[
                { label: "Complete a session", fc: config.sessionComplete },
                { label: "Rate your group", fc: config.rateGroup },
                { label: "Write a review", fc: config.writeReview },
                { label: "Upload a photo", fc: config.uploadPhoto },
                { label: "Report venue info", fc: config.reportVenueInfo },
                { label: "Refer a friend", fc: config.referralComplete },
                { label: "Monthly streak (5+ sessions)", fc: config.streakBonus },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span>{item.label}</span>
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    {effectiveMultiplier > 1.0 ? (
                      <>
                        +{item.fc} FC{" "}
                        <span className="text-[9px] text-amber-500 dark:text-amber-500">
                          ({effectiveMultiplier.toFixed(1)}x = {Math.round(item.fc * effectiveMultiplier)} FC)
                        </span>
                      </>
                    ) : (
                      <>+{item.fc} FC</>
                    )}
                  </span>
                </div>
              ))}
              <p className="text-[10px] pt-1 text-muted-foreground/70">
                Daily earning cap: {config.dailyEarnCap} FC
                {effectiveMultiplier > 1.0 && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400">
                    (your {effectiveMultiplier.toFixed(1)}x multiplier applies!)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </section>
      </motion.div>

      {/* Redemption confirmation dialog */}
      <Dialog open={!!redeemTarget} onOpenChange={() => setRedeemTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {redeemTarget && <redeemTarget.icon className="w-5 h-5 text-primary" />}
              {redeemTarget?.label}
            </DialogTitle>
            <DialogDescription>{redeemTarget?.description}</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-2xl font-bold text-amber-900 dark:text-amber-200">
              {redeemTarget?.cost} FC
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Your balance after: {balance - (redeemTarget?.cost || 0)} FC
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRedeemTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRedeem} disabled={redeeming}>
              {redeeming ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Redeeming...
                </>
              ) : (
                "Confirm Redemption"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
