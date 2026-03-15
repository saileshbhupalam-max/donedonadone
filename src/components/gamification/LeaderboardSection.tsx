import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { RankAvatar } from "./RankAvatar";
import { getRankForHours } from "@/lib/ranks";
import { useNavigate } from "react-router-dom";

interface LeaderEntry {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  focus_hours: number;
  focus_rank: string | null;
}

type Tab = "month" | "alltime";

export function LeaderboardSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("month");
  const [allTime, setAllTime] = useState<LeaderEntry[]>([]);
  const [monthly, setMonthly] = useState<LeaderEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      // All time: top by focus_hours
      const { data: atData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, focus_hours, focus_rank")
        .eq("onboarding_completed", true)
        .order("focus_hours", { ascending: false })
        .limit(20);

      setAllTime((atData || []).map(p => ({ ...p, focus_hours: Number(p.focus_hours ?? 0) })));

      // Monthly: we approximate using feedback from current month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: feedbackData } = await supabase
        .from("event_feedback")
        .select("user_id, event_id, events:event_id(title, start_time, end_time)")
        .eq("attended", true)
        .gte("created_at", monthStart);

      // Group by user, calculate monthly hours
      const userHours: Record<string, { hours: number; profile?: LeaderEntry }> = {};
      (feedbackData || []).forEach((f: any) => {
        if (!userHours[f.user_id]) userHours[f.user_id] = { hours: 0 };
        // Approximate: 2 hours per session
        userHours[f.user_id].hours += 2;
      });

      // Get profile info for monthly leaders
      const userIds = Object.keys(userHours);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url, focus_hours, focus_rank")
          .in("id", userIds);

        const monthlyList = (profiles || []).map(p => ({
          ...p,
          focus_hours: userHours[p.id]?.hours ?? 0,
        })).sort((a, b) => b.focus_hours - a.focus_hours);

        setMonthly(monthlyList);
      }

      setLoaded(true);
    })();
  }, []);

  const data = tab === "alltime" ? allTime : monthly;
  const top10 = data.slice(0, 10);
  const myPosition = useMemo(() => {
    if (!user) return null;
    const idx = data.findIndex(p => p.id === user.id);
    if (idx === -1) return null;
    return { rank: idx + 1, entry: data[idx] };
  }, [data, user]);

  if (!loaded) return null;

  const rankColors = ["text-[#D4A853]", "text-muted-foreground", "text-[#C47B5A]"];

  return (
    <section className="mt-5">
      <div className="px-4 flex items-center gap-3 mb-2">
        <h2 className="font-serif text-lg text-foreground">🏆 Leaderboard</h2>
        <div className="flex gap-1 bg-muted rounded-full p-0.5">
          <button
            onClick={() => setTab("month")}
            className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
              tab === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setTab("alltime")}
            className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
              tab === "alltime" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 px-4 pb-2">
          {top10.map((entry, i) => {
            const rank = getRankForHours(tab === "alltime" ? entry.focus_hours : Number(entry.focus_hours));
            const isMe = entry.id === user?.id;
            return (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/profile/${entry.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/profile/${entry.id}`); } }}
                className={`flex-shrink-0 w-[130px] rounded-xl border p-3 cursor-pointer transition-all hover:shadow-md ${
                  isMe ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-1 mb-2">
                  <span className={`text-sm font-bold ${i < 3 ? rankColors[i] : "text-muted-foreground"}`}>
                    #{i + 1}
                  </span>
                  {isMe && <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">You</span>}
                </div>
                <div className="flex justify-center">
                  <RankAvatar
                    avatarUrl={entry.avatar_url}
                    displayName={entry.display_name}
                    focusHours={tab === "alltime" ? entry.focus_hours : 0}
                    size="md"
                  />
                </div>
                <p className="text-xs font-semibold text-foreground text-center mt-2 truncate">{entry.display_name}</p>
                <p className="text-lg font-bold text-foreground text-center">{entry.focus_hours}</p>
                <p className="text-[9px] text-muted-foreground text-center">hours</p>
              </div>
            );
          })}

          {/* Your position if not in top 10 */}
          {myPosition && myPosition.rank > 10 && (
            <div className="flex-shrink-0 w-[130px] rounded-xl border border-primary bg-primary/5 p-3">
              <p className="text-sm font-bold text-primary text-center">#{myPosition.rank}</p>
              <div className="flex justify-center mt-1">
                <RankAvatar
                  avatarUrl={myPosition.entry.avatar_url}
                  displayName={myPosition.entry.display_name}
                  focusHours={myPosition.entry.focus_hours}
                  size="md"
                />
              </div>
              <p className="text-xs font-semibold text-foreground text-center mt-2">You</p>
              <p className="text-lg font-bold text-foreground text-center">{myPosition.entry.focus_hours}</p>
              <p className="text-[9px] text-muted-foreground text-center">hours</p>
            </div>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Motivational text */}
      {myPosition && myPosition.rank > 1 && (
        <p className="text-xs text-muted-foreground px-4 mt-1">
          You're #{myPosition.rank} of {data.length} · {
            myPosition.rank <= 10
              ? `${(data[myPosition.rank - 2]?.focus_hours ?? 0) - myPosition.entry.focus_hours} hours behind #${myPosition.rank - 1}`
              : `${(data[9]?.focus_hours ?? 0) - myPosition.entry.focus_hours} hours to reach top 10`
          }
        </p>
      )}
    </section>
  );
}

/** Small leaderboard card for Home page */
export function LeaderboardHomeCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [top3, setTop3] = useState<LeaderEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, focus_hours, focus_rank")
        .eq("onboarding_completed", true)
        .order("focus_hours", { ascending: false })
        .limit(50);

      if (data) {
        setTop3(data.slice(0, 3).map(p => ({ ...p, focus_hours: Number(p.focus_hours ?? 0) })));
        const idx = data.findIndex(p => p.id === user?.id);
        if (idx >= 0) setMyRank(idx + 1);
      }
    })();
  }, [user]);

  if (top3.length === 0) return null;

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" role="button" tabIndex={0} onClick={() => navigate("/discover")} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate("/discover"); } }}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">🏆 Leaderboard</p>
          {myRank && <span className="text-xs text-primary">You're #{myRank} →</span>}
        </div>
        <div className="flex gap-3">
          {top3.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
              <RankAvatar avatarUrl={p.avatar_url} displayName={p.display_name} focusHours={p.focus_hours} size="sm" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
