import { useState, useEffect } from "react";
import { Trophy, Medal, Camera, Star, Users, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string | null;
  fc: number;
  topType: string;
  userId: string;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
  totalContributors: number;
}

async function fetchLeaderboard(
  neighborhood: string,
  period: "week" | "allTime",
  currentUserId: string
): Promise<LeaderboardData> {
  // Build the date filter for "week" period
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Step 1: Get profiles in this neighborhood
  const { data: neighborhoodProfiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("neighborhood", neighborhood);

  if (!neighborhoodProfiles || neighborhoodProfiles.length === 0) {
    return { entries: [], currentUser: null, totalContributors: 0 };
  }

  const profileMap = new Map(
    neighborhoodProfiles.map((p) => [p.id, { name: p.display_name, avatar: p.avatar_url }])
  );
  const userIds = neighborhoodProfiles.map((p) => p.id);

  // Step 2: Query focus_credits grouped by user, filtered to neighborhood users
  let creditsQuery = supabase
    .from("focus_credits")
    .select("user_id, amount")
    .in("user_id", userIds);

  if (period === "week") {
    creditsQuery = creditsQuery.gte("created_at", weekAgo);
  }

  const { data: credits } = await creditsQuery;

  if (!credits || credits.length === 0) {
    return { entries: [], currentUser: null, totalContributors: 0 };
  }

  // Aggregate credits per user
  const userTotals = new Map<string, number>();
  for (const row of credits) {
    userTotals.set(row.user_id, (userTotals.get(row.user_id) || 0) + row.amount);
  }

  // Step 3: Query venue_contributions to determine each user's top contribution type
  let contribQuery = supabase
    .from("venue_contributions")
    .select("user_id, contribution_type")
    .in("user_id", userIds);

  if (period === "week") {
    contribQuery = contribQuery.gte("created_at", weekAgo);
  }

  const { data: contributions } = await contribQuery;

  // Count contribution types per user, find the top one
  const userTopType = new Map<string, string>();
  if (contributions && contributions.length > 0) {
    const typeCounts = new Map<string, Map<string, number>>();
    for (const c of contributions) {
      if (!typeCounts.has(c.user_id)) typeCounts.set(c.user_id, new Map());
      const counts = typeCounts.get(c.user_id)!;
      counts.set(c.contribution_type, (counts.get(c.contribution_type) || 0) + 1);
    }
    for (const [userId, counts] of typeCounts) {
      let maxType = "ratings";
      let maxCount = 0;
      for (const [type, count] of counts) {
        if (count > maxCount) {
          maxCount = count;
          maxType = type;
        }
      }
      userTopType.set(userId, maxType);
    }
  }

  // Step 4: Sort users by total FC, take top 10
  const sorted = [...userTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const totalContributors = userTotals.size;

  const entries: LeaderboardEntry[] = sorted.map(([userId, fc], index) => {
    const profile = profileMap.get(userId);
    return {
      rank: index + 1,
      name: profile?.name || "Anonymous",
      avatar: profile?.avatar || null,
      fc,
      topType: userTopType.get(userId) || "ratings",
      userId,
    };
  });

  // Step 5: Find current user in results or query their rank separately
  let currentUser = entries.find((e) => e.userId === currentUserId) || null;

  if (!currentUser && userTotals.has(currentUserId)) {
    const userFc = userTotals.get(currentUserId)!;
    // Count how many users have more FC to determine rank
    const rank = [...userTotals.values()].filter((fc) => fc > userFc).length + 1;
    const profile = profileMap.get(currentUserId);
    currentUser = {
      rank,
      name: profile?.name || "You",
      avatar: profile?.avatar || null,
      fc: userFc,
      topType: userTopType.get(currentUserId) || "ratings",
      userId: currentUserId,
    };
  }

  return { entries, currentUser, totalContributors };
}

interface NeighborhoodLeaderboardProps {
  neighborhood: string;
  userId: string;
}

const TYPE_BADGES: Record<string, { icon: React.ElementType; label: string }> = {
  photos: { icon: Camera, label: "Photographer" },
  referrals: { icon: Users, label: "Connector" },
  "venue-data": { icon: Star, label: "Scout" },
  ratings: { icon: Star, label: "Reviewer" },
};

const RANK_STYLES: Record<number, string> = {
  1: "text-amber-500",
  2: "text-gray-400",
  3: "text-amber-700",
};

export function NeighborhoodLeaderboard({ neighborhood, userId }: NeighborhoodLeaderboardProps) {
  const [period, setPeriod] = useState<"week" | "allTime">("week");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard(neighborhood, period, userId).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [neighborhood, period, userId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            {neighborhood} Leaderboard
          </CardTitle>
        </div>
        {/* User rank callout */}
        {data?.currentUser && (
          <p className="text-sm text-muted-foreground">
            You're <span className="font-semibold text-foreground">#{data.currentUser.rank}</span> in {neighborhood}
          </p>
        )}
        {/* Period tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-0.5 mt-2">
          {(["week", "allTime"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "flex-1 text-xs py-1.5 rounded-md transition-all font-medium",
                period === p ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "week" ? "This Week" : "All Time"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.entries.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-8">
            Be the first contributor!
          </p>
        ) : (
          <>
            {data.entries.map((entry) => {
              const isCurrentUser = entry.userId === userId;
              const badge = TYPE_BADGES[entry.topType];

              return (
                <div
                  key={entry.rank}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg transition-all",
                    isCurrentUser && "bg-primary/5 border border-primary/20"
                  )}
                >
                  {/* Rank */}
                  <div className="w-6 text-center">
                    {entry.rank <= 3 ? (
                      <Medal className={cn("w-5 h-5 mx-auto", RANK_STYLES[entry.rank])} />
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">{entry.rank}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={entry.avatar || undefined} />
                    <AvatarFallback className="text-xs bg-muted">
                      {entry.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name & badge */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", isCurrentUser && "text-primary")}>
                      {isCurrentUser ? "You" : entry.name}
                    </p>
                    {badge && (
                      <div className="flex items-center gap-1">
                        <badge.icon className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{badge.label}</span>
                      </div>
                    )}
                  </div>

                  {/* FC */}
                  <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {entry.fc} FC
                  </span>
                </div>
              );
            })}

            {/* Social proof */}
            <p className="text-xs text-center text-muted-foreground pt-2">
              {data.totalContributors} contributors in {neighborhood} this {period === "week" ? "week" : "month"}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
