import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserContext } from "@/hooks/useUserContext";
import { useSubscription } from "@/hooks/useSubscription";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Coffee, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { getInitials } from "@/lib/utils";

type RouletteState = "idle" | "waiting" | "matched" | "timeout";

interface MatchResult {
  matched_user_id: string;
  matched_display_name: string;
  matched_avatar_url: string | null;
  matched_role_type: string | null;
  taste_match: number;
}

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function CoffeeRoulette() {
  return (
    <FeatureGate featureFlag="coffee_roulette" requireCheckIn requireDnaComplete={20}>
      <CoffeeRouletteInner />
    </FeatureGate>
  );
}

function CoffeeRouletteInner() {
  const { user } = useAuth();
  const { activeCheckIn } = useUserContext();
  const { getLimit } = useSubscription();
  const navigate = useNavigate();
  const [state, setState] = useState<RouletteState>("idle");
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [joining, setJoining] = useState(false);
  const [weeklyUsed, setWeeklyUsed] = useState(0);
  const [limitChecked, setLimitChecked] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueIdRef = useRef<string | null>(null);
  const weeklyLimit = getLimit("roulette_per_week");

  // Check weekly usage
  useEffect(() => {
    if (!user) return;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("coffee_roulette_queue")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("matched_at", "is", null)
      .gte("joined_at", oneWeekAgo)
      .then(({ count }) => {
        setWeeklyUsed(count || 0);
        setLimitChecked(true);
      });
  }, [user?.id]);

  const atLimit = weeklyLimit > 0 && weeklyUsed >= weeklyLimit;

  // Clear all timers
  const clearTimers = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  // Check for existing queue entry on mount
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await supabase
        .from("coffee_roulette_queue")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["waiting", "matched"])
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        queueIdRef.current = data.id;
        if (data.status === "matched" && data.matched_with) {
          await fetchMatchedUser(data.matched_with);
        } else if (data.status === "waiting") {
          setState("waiting");
          startPolling();
          startTimeout();
        }
      }
    };
    check();
    return () => clearTimers();
  }, [user?.id]);

  const fetchMatchedUser = async (matchedUserId: string) => {
    const { data: mp } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", matchedUserId)
      .single();
    if (mp) {
      setMatch({
        matched_user_id: mp.id,
        matched_display_name: mp.display_name || "Someone",
        matched_avatar_url: mp.avatar_url,
        matched_role_type: null,
        taste_match: 0,
      });
      setState("matched");
      clearTimers();
    }
  };

  const startTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      clearTimers();
      // Leave queue server-side
      if (user) {
        await supabase.from("coffee_roulette_queue").delete().eq("user_id", user.id).eq("status", "waiting");
      }
      setState("timeout");
      queueIdRef.current = null;
    }, TIMEOUT_MS);
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (!user) return;

      // First check if we were passively matched by the other user
      const { data: myEntry } = await supabase
        .from("coffee_roulette_queue")
        .select("status, matched_with")
        .eq("user_id", user.id)
        .eq("status", "matched")
        .maybeSingle();

      if (myEntry && myEntry.matched_with) {
        await fetchMatchedUser(myEntry.matched_with);
        return;
      }

      // If still waiting, try to actively match
      const { data } = await supabase.rpc("match_coffee_roulette", { p_user_id: user.id });
      if (data && data.length > 0) {
        setMatch(data[0]);
        setState("matched");
        clearTimers();
      }
    }, 10000);
  };

  const handleJoin = async () => {
    if (!user) return;
    setJoining(true);

    // Clean up stale entries first
    await supabase.rpc("cleanup_stale_roulette", { p_user_id: user.id });

    const { data: inserted, error } = await supabase.from("coffee_roulette_queue").insert({
      user_id: user.id,
      location_id: activeCheckIn?.location_id || null,
      latitude: activeCheckIn?.latitude || null,
      longitude: activeCheckIn?.longitude || null,
      mode: "work",
    }).select().single();

    if (error) {
      toast.error("Failed to join queue");
      setJoining(false);
      return;
    }

    queueIdRef.current = inserted?.id || null;

    // Try immediate match
    const { data: matchData } = await supabase.rpc("match_coffee_roulette", { p_user_id: user.id });
    if (matchData && matchData.length > 0) {
      setMatch(matchData[0]);
      setState("matched");
    } else {
      setState("waiting");
      startPolling();
      startTimeout();
    }
    setJoining(false);
  };

  const handleLeave = async () => {
    if (!user) return;
    clearTimers();
    await supabase.from("coffee_roulette_queue").delete().eq("user_id", user.id).eq("status", "waiting");
    setState("idle");
    queueIdRef.current = null;
  };

  const handleDone = () => {
    setState("idle");
    setMatch(null);
    queueIdRef.current = null;
  };

  return (
    <div className="py-2">
      <AnimatePresence mode="wait">
        {state === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center space-y-3">
                <Coffee className="w-8 h-8 mx-auto text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-foreground">Coffee Roulette</p>
                  <p className="text-xs text-muted-foreground mt-1">Get matched with someone interesting for a quick chat</p>
                </div>
                {atLimit ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Lock className="w-3 h-3" /> You've used your weekly coffee roulette. Upgrade to Plus for unlimited matches.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => navigate("/pricing")}>See Plans</Button>
                  </div>
                ) : (
                  <>
                    <Button onClick={handleJoin} disabled={joining} className="w-full">
                      {joining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coffee className="w-4 h-4 mr-2" />}
                      Join Queue
                    </Button>
                    {weeklyLimit > 0 && limitChecked && (
                      <p className="text-[10px] text-muted-foreground">{weeklyLimit - weeklyUsed} of {weeklyLimit} roulette match{weeklyLimit === 1 ? "" : "es"} remaining this week</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {state === "waiting" && (
          <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/10">
              <CardContent className="p-4 text-center space-y-3">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Coffee className="w-10 h-10 mx-auto text-amber-600" />
                </motion.div>
                <div>
                  <p className="text-sm font-medium text-foreground">Looking for your match...</p>
                  <p className="text-xs text-muted-foreground mt-1">We'll find someone great. Hang tight!</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLeave}>Leave Queue</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {state === "timeout" && (
          <motion.div key="timeout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center space-y-3">
                <Coffee className="w-8 h-8 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">No one available right now</p>
                  <p className="text-xs text-muted-foreground mt-1">Try again later — more people check in throughout the day!</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleDone}>Got it</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {state === "matched" && match && (
          <motion.div
            key="matched"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <Card className="border-green-500/20 bg-green-50/50 dark:bg-green-950/10">
              <CardContent className="p-4 text-center space-y-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                >
                  <Avatar className="w-16 h-16 mx-auto ring-2 ring-green-500/30">
                    <AvatarImage src={match.matched_avatar_url || ""} />
                    <AvatarFallback className="text-lg">{getInitials(match.matched_display_name)}</AvatarFallback>
                  </Avatar>
                </motion.div>
                <div>
                  <p className="text-sm font-medium text-foreground">{match.matched_display_name}</p>
                  {match.matched_role_type && (
                    <Badge variant="outline" className="text-[10px] mt-1 capitalize">{match.matched_role_type}</Badge>
                  )}
                  {match.taste_match >= 60 && (
                    <Badge className="text-[10px] mt-1 ml-1 bg-green-500/10 text-green-700 border-green-500/20">
                      {match.taste_match}% match
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Say hi — they're nearby! ☕</p>
                <Button variant="outline" size="sm" onClick={handleDone}>Done</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
