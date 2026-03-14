import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Download, Trophy } from "lucide-react";
import { toast } from "sonner";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { MONTHLY_TITLE_DEFS, ACHIEVEMENT_DEFS, getAchievementDef, getRankForHours, RANK_TIERS } from "@/lib/ranks";
import { RankAvatar } from "@/components/gamification/RankAvatar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const RANK_COLORS: Record<string, string> = {
  Newcomer: "#9CA3AF",
  "Getting Started": "#7B9E87",
  Regular: "#C47B5A",
  "Deep Worker": "#C47B5A",
  Elite: "#D4A853",
  Grandmaster: "#D4A853",
};

interface TitleCandidate {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  focus_hours: number;
  value: number;
}

export function StatusGameTab() {
  const [candidates, setCandidates] = useState<Record<string, TitleCandidate[]>>({});
  const [achievements, setAchievements] = useState<any[]>([]);
  const [rankDist, setRankDist] = useState<any[]>([]);
  const [pastTitles, setPastTitles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcing, setAnnouncing] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const prevMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
      const prevMonthEnd = endOfMonth(subMonths(now, 1)).toISOString();

      const [
        { data: allProfiles },
        { data: feedback },
        { data: prevFeedback },
        { data: fireData },
        { data: referrals },
        { data: allAchievements },
        { data: allTitles },
      ] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url, focus_hours, focus_rank, referred_by, created_at").eq("onboarding_completed", true),
        supabase.from("event_feedback").select("user_id, created_at").eq("attended", true).gte("created_at", monthStart),
        supabase.from("event_feedback").select("user_id, created_at").eq("attended", true).gte("created_at", prevMonthStart).lte("created_at", prevMonthEnd),
        supabase.from("prompt_responses").select("user_id, fire_count, created_at").gte("created_at", monthStart),
        supabase.from("profiles").select("referred_by, created_at").gte("created_at", monthStart),
        supabase.from("exclusive_achievements").select("user_id, achievement_type, achieved_at"),
        supabase.from("monthly_titles").select("title_type, month, value, user_id").order("month", { ascending: false }),
      ]);

      setProfiles(allProfiles || []);
      const profileMap = new Map((allProfiles || []).map(p => [p.id, p]));

      // Focus Champion: most sessions this month
      const monthSessions: Record<string, number> = {};
      (feedback || []).forEach(f => { monthSessions[f.user_id] = (monthSessions[f.user_id] || 0) + 1; });
      const focusChampion = Object.entries(monthSessions)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([uid, sessions]) => {
          const p = profileMap.get(uid);
          return { user_id: uid, display_name: p?.display_name || "Unknown", avatar_url: p?.avatar_url ?? null, focus_hours: Number(p?.focus_hours ?? 0), value: sessions * 2 };
        });

      // Rising Star: biggest month-over-month improvement
      const prevSessions: Record<string, number> = {};
      (prevFeedback || []).forEach(f => { prevSessions[f.user_id] = (prevSessions[f.user_id] || 0) + 1; });
      const risingStarData: Record<string, number> = {};
      Object.entries(monthSessions).forEach(([uid, count]) => {
        risingStarData[uid] = count - (prevSessions[uid] || 0);
      });
      const risingStar = Object.entries(risingStarData)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([uid, improvement]) => {
          const p = profileMap.get(uid);
          return { user_id: uid, display_name: p?.display_name || "Unknown", avatar_url: p?.avatar_url ?? null, focus_hours: Number(p?.focus_hours ?? 0), value: improvement };
        });

      // Community Voice: most fires on prompt answers this month
      const userFires: Record<string, number> = {};
      (fireData || []).forEach(f => { userFires[f.user_id] = (userFires[f.user_id] || 0) + (f.fire_count || 0); });
      const communityVoice = Object.entries(userFires)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([uid, fires]) => {
          const p = profileMap.get(uid);
          return { user_id: uid, display_name: p?.display_name || "Unknown", avatar_url: p?.avatar_url ?? null, focus_hours: Number(p?.focus_hours ?? 0), value: fires };
        });

      // Connector: most referrals this month
      const referralCounts: Record<string, number> = {};
      (referrals || []).forEach(r => {
        if (r.referred_by) referralCounts[r.referred_by] = (referralCounts[r.referred_by] || 0) + 1;
      });
      const connector = Object.entries(referralCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([uid, count]) => {
          const p = profileMap.get(uid);
          return { user_id: uid, display_name: p?.display_name || "Unknown", avatar_url: p?.avatar_url ?? null, focus_hours: Number(p?.focus_hours ?? 0), value: count };
        });

      setCandidates({
        focus_champion: focusChampion,
        rising_star: risingStar,
        most_loved: communityVoice, // using fire_count as proxy
        community_voice: communityVoice,
        connector,
        session_mvp: focusChampion, // approximate
      });

      // Achievements
      const achievementData = ACHIEVEMENT_DEFS.map(def => {
        const earned = (allAchievements || []).filter(a => a.achievement_type === def.type);
        return {
          ...def,
          earnedBy: earned.map(a => ({
            user_id: a.user_id,
            display_name: profileMap.get(a.user_id)?.display_name || "Unknown",
            achieved_at: a.achieved_at,
          })),
          count: earned.length,
        };
      });
      setAchievements(achievementData);

      // Rank distribution
      const rankCounts: Record<string, number> = {};
      RANK_TIERS.forEach(t => { rankCounts[t.name] = 0; });
      (allProfiles || []).forEach(p => {
        const rank = getRankForHours(Number(p.focus_hours ?? 0));
        rankCounts[rank.name] = (rankCounts[rank.name] || 0) + 1;
      });
      setRankDist(RANK_TIERS.map(t => ({
        name: `${t.emoji} ${t.name}`,
        count: rankCounts[t.name] || 0,
        color: RANK_COLORS[t.name] || "#9CA3AF",
      })));

      // Past titles
      const titleRows = (allTitles || []).map(t => {
        const p = profileMap.get(t.user_id);
        const def = MONTHLY_TITLE_DEFS[t.title_type];
        return {
          ...t,
          display_name: p?.display_name || "Unknown",
          title_label: def ? `${def.emoji} ${def.name}` : t.title_type,
          value: Number(t.value ?? 0),
        };
      });
      setPastTitles(titleRows);

      setLoading(false);
    })();
  }, []);

  const announceWinners = async () => {
    setAnnouncing(true);
    try {
      const now = new Date();
      const prevMonth = subMonths(now, 1);
      const monthStr = format(prevMonth, "yyyy-MM");
      const monthLabel = format(prevMonth, "MMMM yyyy");

      // Check if already announced
      const { data: existing } = await supabase.from("monthly_titles").select("id").eq("month", monthStr).limit(1);
      if (existing && existing.length > 0) {
        toast.error(`Titles for ${monthLabel} have already been announced.`);
        setAnnouncing(false);
        return;
      }

      const titleTypes = ["focus_champion", "rising_star", "most_loved", "community_voice", "connector", "session_mvp"] as const;
      const winners: { type: string; user_id: string; display_name: string; value: number }[] = [];

      for (const type of titleTypes) {
        const cands = candidates[type];
        if (cands && cands.length > 0) {
          const winner = cands[0];
          await supabase.from("monthly_titles").insert({
            user_id: winner.user_id,
            title_type: type,
            month: monthStr,
            value: winner.value,
          });
          winners.push({ type, user_id: winner.user_id, display_name: winner.display_name, value: winner.value });
        }
      }

      if (winners.length === 0) {
        toast.error("No candidates to announce.");
        setAnnouncing(false);
        return;
      }

      // Notify all members
      const { data: allMembers } = await supabase.from("profiles").select("id").eq("onboarding_completed", true);
      if (allMembers) {
        const champName = winners.find(w => w.type === "focus_champion")?.display_name || "—";
        const starName = winners.find(w => w.type === "rising_star")?.display_name || "—";
        const lovedName = winners.find(w => w.type === "most_loved")?.display_name || "—";

        for (const m of allMembers) {
          await supabase.rpc("create_system_notification", {
            p_user_id: m.id,
            p_title: `🏆 ${monthLabel} titles are in!`,
            p_body: `Focus Champion: ${champName}. Rising Star: ${starName}. Most Loved: ${lovedName}.`,
            p_type: "monthly_titles",
            p_link: "/discover",
          });
        }

        // Individual winner notifications
        for (const w of winners) {
          const def = MONTHLY_TITLE_DEFS[w.type];
          if (!def) continue;
          await supabase.rpc("create_system_notification", {
            p_user_id: w.user_id,
            p_title: `You won ${def.emoji} ${def.name} for ${monthLabel}!`,
            p_body: "Share your achievement with the community →",
            p_type: "title_won",
            p_link: "/me",
          });
        }
      }

      toast.success("Winners announced! Notifications sent.");
    } catch (error) {
      console.error("[AnnounceWinners]", error);
      toast.error("Something went wrong announcing winners.");
    }
    setAnnouncing(false);
  };

  const exportMembersCSV = () => {
    const headers = ["Name", "Email", "Joined", "Focus Hours", "Focus Rank", "Sessions Attended", "Profile Completion", "Neighborhood", "Work Vibe", "Last Active"];
    const rows = profiles.map(p => [
      p.display_name || "", "", (p.created_at || "").split("T")[0],
      p.focus_hours ?? 0, p.focus_rank || "Newcomer", p.events_attended || 0,
      p.profile_completion || 0, p.neighborhood || "", p.work_vibe || "", (p.last_active_at || "").split("T")[0],
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `danadone-members-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  const renderCandidates = (type: string, label: string, unit: string) => {
    const cands = candidates[type] || [];
    if (cands.length === 0) return null;
    const def = MONTHLY_TITLE_DEFS[type];
    return (
      <Card key={type}>
        <CardContent className="p-3">
          <p className="text-xs font-medium text-foreground mb-2">{def?.emoji} {label}</p>
          {cands.map((c, i) => (
            <div key={c.user_id} className="flex items-center gap-2 py-1">
              <span className={`text-xs font-bold w-5 ${i === 0 ? "text-[#D4A853]" : "text-muted-foreground"}`}>#{i + 1}</span>
              <RankAvatar avatarUrl={c.avatar_url} displayName={c.display_name} focusHours={c.focus_hours} size="sm" />
              <span className="text-xs text-foreground flex-1 truncate">{c.display_name}</span>
              <span className="text-xs font-medium text-foreground">{c.value} {unit}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Monthly Title Candidates */}
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-base text-foreground">Monthly Title Candidates</h3>
        <Button size="sm" onClick={announceWinners} disabled={announcing} className="gap-1">
          <Trophy className="w-3.5 h-3.5" />
          {announcing ? "Announcing..." : "Announce Winners"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {renderCandidates("focus_champion", "Focus Champion", "hrs")}
        {renderCandidates("rising_star", "Rising Star", "Δ")}
        {renderCandidates("community_voice", "Community Voice", "🔥")}
        {renderCandidates("connector", "Connector", "refs")}
      </div>

      {/* Past titles history */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
          <span className="text-sm font-medium text-foreground">Title History ({pastTitles.length})</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="border rounded-lg overflow-hidden">
            {pastTitles.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No titles awarded yet</p>
            ) : (
              pastTitles.map((t, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 border-t first:border-t-0">
                  <span className="text-sm">{t.title_label}</span>
                  <span className="text-xs text-foreground flex-1">{t.display_name}</span>
                  <span className="text-xs text-muted-foreground">{t.month}</span>
                  <span className="text-xs text-foreground font-medium">{t.value}</span>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Achievements Overview */}
      <h3 className="font-serif text-base text-foreground mt-6">Exclusive Achievements</h3>
      <div className="space-y-2">
        {achievements.map(a => (
          <Card key={a.type}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{a.emoji}</span>
                  <div>
                    <p className="text-xs font-medium text-foreground">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.description}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {a.exclusive
                    ? (a.earnedBy.length > 0 ? `🏅 ${a.earnedBy[0].display_name}` : "Unclaimed")
                    : `${a.count} earned`
                  }
                </span>
              </div>
              {a.earnedBy.length > 0 && !a.exclusive && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {a.earnedBy.slice(0, 5).map((e: any) => (
                    <span key={e.user_id} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      {e.display_name}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rank Distribution */}
      <h3 className="font-serif text-base text-foreground mt-6">Rank Distribution</h3>
      <Card>
        <CardContent className="p-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rankDist} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {rankDist.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Export */}
      <Button variant="outline" className="w-full gap-2" onClick={exportMembersCSV}>
        <Download className="w-4 h-4" /> Export Members CSV
      </Button>
    </div>
  );
}
