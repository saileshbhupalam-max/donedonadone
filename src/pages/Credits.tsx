import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getBalance, fulfillRedemption, type CreditAction } from "@/lib/focusCredits";
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
};

interface RedeemOption {
  action: CreditAction;
  label: string;
  description: string;
  cost: number;
  icon: React.ElementType;
}

export default function Credits() {
  usePageTitle("Focus Credits — DanaDone");
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemTarget, setRedeemTarget] = useState<RedeemOption | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const config = getGrowthConfig().credits;

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
      description: "Access invite-only premium sessions",
      cost: config.exclusiveSession,
      icon: Sparkles,
    },
    {
      action: "redeem_pick_seat",
      label: "Pick Your Seat",
      description: "Choose your table and group before others",
      cost: config.pickSeat,
      icon: Armchair,
    },
    {
      action: "redeem_venue_upgrade",
      label: "Venue Upgrade",
      description: "Upgrade to a premium venue for your next session",
      cost: config.venueUpgrade,
      icon: ArrowUpRight,
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
  ];

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [bal, { data: entries }] = await Promise.all([
      getBalance(user.id),
      supabase
        .from("focus_credits")
        .select("id, amount, action, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setBalance(bal);
    setHistory((entries as LedgerEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

        <Separator />

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
                return (
                  <Card
                    key={opt.action}
                    className={`cursor-pointer transition-all ${
                      canAfford
                        ? "hover:shadow-md hover:border-primary/40"
                        : "opacity-50"
                    }`}
                    onClick={() => canAfford && setRedeemTarget(opt)}
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

        {/* How to earn */}
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
                    +{item.fc} FC
                  </span>
                </div>
              ))}
              <p className="text-[10px] pt-1 text-muted-foreground/70">
                Daily earning cap: {config.dailyEarnCap} FC
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
